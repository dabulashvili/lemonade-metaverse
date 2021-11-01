import { Arg, Args, Resolver, Info, Root, Query, Subscription } from 'type-graphql';
import { GraphQLResolveInfo } from 'graphql';

import { Order, OrderModel } from '../../app/models/order';
import { OrderWhere } from '../types/order';
import { PaginationArgs } from '../types/pagination';
import { SortArgs } from '../types/sort';

import { getFieldTree, getFieldProjection } from '../utils/field';
import { getFilter, validate } from '../utils/where';
import { getSort } from '../utils/sort';
import { subscribe } from '../utils/subscription';

const findOrders = async (
  { skip, limit, where, orderBy, orderDirection }: PaginationArgs & SortArgs & { where?: OrderWhere | null },
  info: GraphQLResolveInfo,
) => {
  const fields = getFieldTree(info);
  const query = where ? getFilter({ ...where, token: undefined }) : {};

  return await OrderModel.aggregate([
    { $match: query },
    ...fields.token ? [
      {
        $lookup: {
          from: 'tokens',
          let: { token: '$token' },
          pipeline: [{ $match: { $expr: { $eq: ['$id', '$$token'] }, ...where?.token && getFilter(where.token) } }],
          as: 'token',
        },
      },
      { $unwind: '$token' },
    ] : [],
    ...orderBy ? [{
      $sort: getSort({ orderBy, orderDirection }),
    }] : [],
    { $skip: skip },
    { $limit: limit },
    { $project: getFieldProjection(fields) },
  ]);
};

@Resolver()
class _OrdersQueryResolver {
  @Query(() => [Order])
  async orders(
    @Info() info: GraphQLResolveInfo,
    @Args() paginationArgs: PaginationArgs,
    @Args() sortArgs: SortArgs,
    @Arg('where', () => OrderWhere, { nullable: true }) where?: OrderWhere | null,
  ): Promise<Order[]> {
    return await findOrders({ ...paginationArgs, ...sortArgs, where }, info);
  }
}

@Resolver()
class _OrdersSubscriptionResolver {
  @Subscription(
    () => [Order],
    {
      subscribe: subscribe<Order[], Order>('order_updated', {
        init: async function* ({ args, info }) {
          if (args.query) yield findOrders(args, info);
        },
        filter: (payload, { args }) => args.where ? validate(args.where, payload) : true,
        process: (payload) => [payload],
      }),
    }
  )
  orders(
    @Root() root: Order[],
    @Args() _: PaginationArgs,
    @Args() __: SortArgs,
    @Arg('query', () => Boolean, { nullable: true }) ___?: boolean | null,
    @Arg('where', () => OrderWhere, { nullable: true }) ____?: OrderWhere | null,
  ): Order[] {
    return root;
  }
}
