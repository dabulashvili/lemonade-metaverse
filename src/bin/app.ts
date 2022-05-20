#!/usr/bin/env node
import 'reflect-metadata';
import 'source-map-support/register';
import * as prom from 'prom-client';
import * as util from 'util';

import { app } from '../app';
import { logger } from '../app/helpers/pino';
import * as db from '../app/helpers/db';
import * as metrics from '../app/services/metrics';
import * as redis from '../app/helpers/redis';
import * as network from '../app/services/network';

import { appPort, sourceVersion } from '../config';

import { createApolloServer, ApolloServer } from '../graphql';

let apolloServer: ApolloServer | undefined;

process.on('uncaughtException', function onUncaughtException(err) {
  logger.error(err, 'uncaughtException');
});

process.on('uncaughtRejection', function onUncaughtRejection(err) {
  logger.error(err, 'uncaughtRejection');
});

async function shutdown() {
  try {
    if (apolloServer) await apolloServer.stop();

    redis.disconnect();
    await Promise.all([
      db.disconnect(),
      metrics.stop(),
      network.close(),
    ]);

    process.exit(0);
  } catch (err: any) {
    logger.fatal(err);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  metrics.start();
  await db.connect();
  await network.init();

  apolloServer = await createApolloServer(app);

  await apolloServer.start();

  app.register(apolloServer.createHandler());

  await app.listen(appPort, '0.0.0.0');

  logger.info({ version: sourceVersion }, 'metaverse app started');

  const getConnections = util.promisify(app.server.getConnections).bind(app.server);

  new prom.Gauge({
    name: 'http_open_connections',
    help: 'Number of open HTTP connections',
    collect: async function() { this.set(await getConnections()); },
  });
}

void main();
