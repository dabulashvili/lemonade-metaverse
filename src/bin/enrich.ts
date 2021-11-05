#!/usr/bin/env node
import 'reflect-metadata';
import 'source-map-support/register';

import { logger } from '../app/helpers/pino';
import * as db from '../app/helpers/db';
import * as enrich from '../app/services/enrich/worker';
import * as metrics from '../app/services/metrics';
import * as redis from '../app/helpers/redis';

import { sourceVersion } from '../config';

process.on('uncaughtException', function onUncaughtException(err) {
  logger.error(err, 'uncaughtException');
});

process.on('uncaughtRejection', function onUncaughtRejection(err) {
  logger.error(err, 'uncaughtRejection');
});

const shutdown = async () => {
  try {
    await enrich.stop();

    redis.disconnect();
    await Promise.all([
      db.disconnect(),
      metrics.stop(),
    ]);

    process.exit(0);
  } catch (err: any) {
    logger.fatal(err);
    process.exit(1);
  }
};

process.on('SIGINT', async function onSigintSignal() {
  await shutdown();
});

process.on('SIGTERM', async function onSigtermSignal() {
  await shutdown();
});

const main = async () => {
  metrics.start();
  await db.connect();

  await enrich.start();

  logger.info({ version: sourceVersion }, 'metaverse enrich started');
};

void main();
