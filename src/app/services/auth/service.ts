import * as assert from 'assert';
import * as jwt from 'jsonwebtoken';

import { logger } from '../../helpers/pino';

import { Auth } from './types';
import { AuthenticationError } from '../../types/errors';
import { ParameterizedContext } from '../../types';

import { jwtKey } from '../../../config';

export const authenticate = async (
  { request }: ParameterizedContext,
) => {
  const token = request.headers.authorization?.split(' ')[1];

  assert.ok(token, new AuthenticationError('The authorization token is missing.'));

  let payload: string | Record<string, unknown>;
  try {
    payload = jwt.verify(token, jwtKey) as typeof payload;
  } catch (err) {
    logger.debug(err);

    throw new AuthenticationError('The authorization token is invalid.');
  }

  assert.ok(typeof payload === 'object' && typeof payload.user === 'string', new AuthenticationError('The authorization token payload is invalid.'));

  const auth: Auth = { user: payload.user };

  if (typeof payload.enjin_user === 'number') {
    auth.enjin_user = payload.enjin_user;
  }

  return auth;
};
