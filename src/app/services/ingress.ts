import { BulkWriteOperation } from 'mongodb';
import { Histogram } from 'prom-client';

import { logger } from '../helpers/pino';
import * as enrich from './enrich';
import * as indexer from '../helpers/indexer';

import { OfferModel, Offer } from '../models/offer';
import { StateModel } from '../models/state';

import { GetOffers } from '../../lib/lemonade-marketplace-subgraph/documents.generated';
import { GetOffersQuery, GetOffersQueryVariables, Offer as OfferType } from '../../lib/lemonade-marketplace-subgraph/types.generated';

const BACKFILL_LAST_BLOCK_KEY = 'backfill_last_block';

const durationSeconds = new Histogram({
  name: 'nft_ingress_duration_seconds',
  help: 'Duration of NFT ingress in seconds',
});

let timer: NodeJS.Timeout | null = null;

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
  const state = await StateModel.findOne(
    { key: BACKFILL_LAST_BLOCK_KEY },
    { value: 1 }
  ).lean<{ value: string }>();

  let lastBlock_gt = state?.value;
  const run = async () => {
    const lastBlock = await poll(lastBlock_gt);

    if (lastBlock && lastBlock !== lastBlock_gt) {
      lastBlock_gt = lastBlock;

      await StateModel.updateOne(
        { key: BACKFILL_LAST_BLOCK_KEY },
        { $set: { value: lastBlock } },
        { upsert: true },
      );
    }

    timer = setTimeout(run, 1000);
  };
  await run();
};

export const close = async () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  indexer.client.stop();
  await enrich.queue.close();
};
