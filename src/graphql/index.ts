import { ApolloServer } from 'apollo-server-koa';
import { ApolloServerPluginLandingPageGraphQLPlayground, ApolloServerPluginLandingPageDisabled } from 'apollo-server-core';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import * as http from 'http';

import { schema } from './schema';

import { apolloDebug, apolloIntrospection, isProduction } from '../config';

const KEEP_ALIVE = 5000;

export const createServers = async (
  server: http.Server,
): Promise<{
  apolloServer: ApolloServer;
  subscriptionServer: SubscriptionServer,
}> => {
  const apolloServer = new ApolloServer({
    context: ({ ctx }) => ({ app: ctx }),
    debug: apolloDebug,
    introspection: apolloIntrospection,
    plugins: [
      isProduction ? ApolloServerPluginLandingPageDisabled() : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
    schema,
  });

  const subscriptionServer = SubscriptionServer.create(
    {
      schema,
      execute,
      subscribe,
      keepAlive: KEEP_ALIVE,
    },
    {
      path: apolloServer.graphqlPath,
      server,
    }
  );

  return {
    apolloServer,
    subscriptionServer,
  };
};
