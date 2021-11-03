import { Arg, Args, Resolver, Info, Root, Query, Subscription } from 'type-graphql';
import { GraphQLResolveInfo } from 'graphql';

import { PaginationArgs } from '../types/pagination';
import { SortArgs } from '../types/sort';
import { Token, TokenModel } from '../../app/models/token';
import { TokenWhere } from '../types/token';

import { getFieldTree, getFieldProjection } from '../utils/field';
import { getFilter, validate } from '../utils/where';
import { getSort } from '../utils/sort';
import { getToken, getTokens } from '../../app/services/token';
import { subscribe } from '../utils/subscription';

const findTokens = async (
  { skip, limit, orderBy, orderDirection, where }: PaginationArgs & SortArgs & { where?: TokenWhere | null },
  info: GraphQLResolveInfo,
) => {
  const fields = getFieldTree(info);
  const query = where ? getFilter({ ...where, token: undefined }) : {};

  return await TokenModel.aggregate([
    { $match: query },
    ...orderBy ? [{
      $sort: getSort({ orderBy, orderDirection }),
    }] : [],
    { $skip: skip },
    { $limit: limit },
    { $project: getFieldProjection(fields) },
  ]);
};

@Resolver()
class _TokensQueryResolver {
  @Query(() => Token, { nullable: true })
  async getToken(
    @Arg('id', () => String) id: string,
  ): Promise<Token | undefined> {
    return await getToken(id);
  }

  @Query(() => [Token])
  async getTokens(
    @Args() { skip, limit }: PaginationArgs,
    @Arg('id', () => String, { nullable: true }) id?: string,
    @Arg('id_in', () => [String], { nullable: true }) id_in?: string[],
    @Arg('contract', () => String, { nullable: true }) contract?: string,
    @Arg('tokenId', () => String, { nullable: true }) tokenId?: string,
    @Arg('owner', () => String, { nullable: true }) owner?: string,
  ): Promise<Token[]> {
    return await getTokens({
      where: { id, id_in, contract, tokenId, owner },
      skip,
      first: limit,
    });
  }

  @Query(() => [Token])
  async tokens(
    @Info() info: GraphQLResolveInfo,
    @Args() paginationArgs: PaginationArgs,
    @Args() sortArgs: SortArgs,
    @Arg('where', () => TokenWhere, { nullable: true }) where?: TokenWhere | null,
  ): Promise<Token[]> {
    return await findTokens({ ...paginationArgs, ...sortArgs, where }, info);
  }
}

@Resolver()
class _TokensSubscriptionResolver {
  @Subscription(
    () => [Token],
    {
      subscribe: subscribe<Token[], Token>('token_updated', {
        init: async function* ({ args, info }) {
          if (args.query) yield findTokens(args, info);
        },
        filter: (payload, { args }) => args.where ? validate(args.where, payload) : true,
        process: (payload) => [payload],
      }),
    }
  )
  tokens(
    @Root() root: Token[],
    @Args() _: PaginationArgs,
    @Args() __: SortArgs,
    @Arg('query', () => Boolean, { nullable: true }) ___?: boolean | null,
    @Arg('where', () => TokenWhere, { nullable: true }) ____?: TokenWhere | null,
  ): Token[] {
    return root;
  }
}
