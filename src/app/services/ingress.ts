import { BulkWriteOperation } from 'mongodb';
import { Histogram } from 'prom-client';

import { logger } from '../helpers/pino';
import * as enrich from './enrich';
import * as indexer from '../helpers/indexer';

import { OfferModel, Offer } from '../models/offer';

import { Offers } from '../../lib/lemonade-marketplace-subgraph/documents.generated';
import { OffersSubscription, OffersSubscriptionVariables } from '../../lib/lemonade-marketplace-subgraph/types.generated';

const durationSeconds = new Histogram({
  name: 'nft_ingress_duration_seconds',
  help: 'Duration of NFT ingress in seconds',
});

const process = async function (
  offers: OffersSubscription['offers'],
) {
  const stopTimer = durationSeconds.startTimer();

  const { upsertedIds } = await OfferModel.bulkWrite(offers.map<BulkWriteOperation<Offer>>((offer) => ({
    updateOne: {
      filter: { id: offer.id },
      update: {
        $set: {
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

export const subscribe = () => {
  const observable = indexer.client.subscribe<OffersSubscription, OffersSubscriptionVariables>({ query: Offers });

  return observable.subscribe({
    next({ data, errors }) {
      if (errors?.length) {
        logger.error({ errors });
      } else if (data?.offers) {
        logger.debug({ offers: data.offers });

        process(data.offers).catch((error) => {
          logger.error(error, 'failed to process');
        });
      }
    },
    error(error) {
      logger.error(error, 'failed to observe');
    },
  });
};

export const close = async () => {
  indexer.close();
  await enrich.queue.close();
};
