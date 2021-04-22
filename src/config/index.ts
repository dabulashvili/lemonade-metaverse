const parseBoolean = (value?: string) => {
  return value === 'true' || value === '1';
};

export const apolloDebug = parseBoolean(process.env.APOLLO_DEBUG);
export const apolloIntropection = parseBoolean(process.env.APOLLO_INTROSPECTION);
export const appKey = process.env.APP_KEY || 'dummy';
export const databaseDebug = parseBoolean(process.env.DATABASE_DEBUG);
export const databaseUri = process.env.DATABASE_URI || 'mongodb://localhost';
export const environment = process.env.NODE_ENV || 'development';
export const indexerHttpUri = process.env.INDEXER_HTTP_URI || 'dummy';
export const ipfsGatewayUri = process.env.IPFS_GATEWAY_URI || 'https://ipfs.io';
export const port = parseInt(process.env.PORT || '4000');
export const redisUri = process.env.REDIS_URI;
export const sourceVersion = process.env.SOURCE_VERSION || 'unknown';
export const web3Uri = process.env.WEB3_URI || 'dummy';

export const isDevelopment = environment === 'development';
export const isProduction = environment === 'production';
