import { BulkWriteOperation } from 'mongodb';
import { Histogram } from 'prom-client';
import { Queue, QueueScheduler, Worker } from 'bullmq';

import { logger } from '../helpers/pino';
import { redis } from '../helpers/redis';
import * as enrich from './enrich';
import * as indexer from '../helpers/indexer';

import { OfferModel, Offer } from '../models/offer';
import { StateModel } from '../models/state';

import { GetOffers } from '../../lib/lemonade-marketplace-subgraph/documents.generated';
import { GetOffersQuery, GetOffersQueryVariables, Offer as OfferType } from '../../lib/lemonade-marketplace-subgraph/types.generated';

const LAST_BLOCK_KEY = 'ingress_last_block';

const durationSeconds = new Histogram({
  name: 'nft_ingress_duration_seconds',
  help: 'Duration of NFT ingress in seconds',
});

type Data = null;
const queue = new Queue<Data>('INGRESS_QUEUE', { connection: redis });
const queueScheduler = new QueueScheduler(queue.name, { connection: redis });

const process = async function (
  offers: OfferType[],
) {
  const stopTimer = durationSeconds.startTimer();

  const { upsertedIds } = await OfferModel.bulkWrite(offers.map<BulkWriteOperation<Offer>>((offer) => ({
    updateOne: {
      filter: { id: offer.id },
      update: {
        $set: {
          lastBlock: offer.lastBlock,
          created_at: new Date(parseInt(offers[0].createdAt) * 1000),
          offer_contract: offer.offerContract,
          offer_id: offer.offerId,
          token_uri: offer.tokenURI,
          active: offer.active,
          seller: offer.seller,
          currency: offer.currency,
          price: offer.price,
          token_contract: offer.tokenContract,
          token_id: offer.tokenId,
          buyer: offer.buyer || undefined,
        },
      },
      upsert: true,
    },
  })));

  const upserts = Object
    .keys(upsertedIds || {})
    .map((key) => offers[parseInt(key)]);

  if (upserts.length) {
    await enrich.queue.addBulk(upserts.map((offer) => ({
      name: 'enrich',
      data: {
        id: offer.id,
        token_uri: offer.tokenURI,
      },
    })));
  }

  stopTimer();
};

export const poll = async (
  lastBlock_gt?: string,
) => {
  let skip = 0;
  const first = 1000;

  let length = 0;
  let lastBlock: string | undefined;
  do {
    const { data } = await indexer.client.query<GetOffersQuery, GetOffersQueryVariables>({
      query: GetOffers,
      variables: { lastBlock_gt, skip, first },
    });

    length = data?.offers?.length || 0;
    logger.debug({ skip, first, length });

    if (length) {
      await process(data.offers);

      skip += first;
      lastBlock = data.offers[length - 1].lastBlock; // requires asc sort on lastBlock
    }
  } while (length);

  return lastBlock;
};

export const start = async () => {
  const repeatableJobs = await queue.getRepeatableJobs();
  const ingressJobs = repeatableJobs.filter((job) => job.name === 'ingress');

  if (ingressJobs.length) await Promise.all(ingressJobs.map((job) => queue.removeRepeatableByKey(job.key)));

  await queue.add('ingress', null, { repeat: { every: 2000 } });

  new Worker<Data>(queue.name, async function () {
    const stopTimer = durationSeconds.startTimer();

    const state = await StateModel.findOne(
      { key: LAST_BLOCK_KEY },
      { value: 1 }
    ).lean<{ value: string }>();

    const lastBlock_gt = state?.value;
    const lastBlock = await poll(lastBlock_gt);

    if (lastBlock && lastBlock !== lastBlock_gt) {
      await StateModel.updateOne(
        { key: LAST_BLOCK_KEY },
        { $set: { value: lastBlock } },
        { upsert: true },
      );
    }

    stopTimer();
  });

};

export const close = async () => {
  await enrich.queue.close();
  await queue.close();
  await queueScheduler.close();
  indexer.client.stop();
};
