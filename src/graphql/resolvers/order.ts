import { Arg, Args, Resolver, Info, Root, Query, Subscription } from 'type-graphql';
import { GraphQLResolveInfo } from 'graphql';

import { Order, OrderModel } from '../../app/models/order';
import { OrderWhere } from '../types/order';
import { PaginationArgs } from '../types/pagination';

import { getFieldTree, getFieldProjection } from '../utils/field';
import { getFilter, validate } from '../utils/where';
import { subscribe } from '../utils/subscription';

const findOrders = async (
  { skip, limit, where }: PaginationArgs & { where?: OrderWhere | null },
  info: GraphQLResolveInfo,
) => {
  const fields = getFieldTree(info);
  const filterToken = where && where.token && getFilter(where.token);
  const filter = where && getFilter({ ...where, token: undefined });

  if (filter && filterToken?.id) filter.token = filterToken.id;

  return await OrderModel.aggregate([
    { $match: filter },
    ...fields.token ? [
      {
        $lookup: {
          from: 'tokens',
          let: { token: '$token' },
          pipeline: [{ $match: { $expr: { $eq: ['$id', '$$token'] }, ...filterToken } }],
          as: 'token',
        },
      },
      { $unwind: '$token' },
    ] : [],
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
    @Args() args: PaginationArgs,
    @Arg('where', () => OrderWhere, { nullable: true }) where?: OrderWhere | null,
  ): Promise<Order[]> {
    return await findOrders({ ...args, where }, info);
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
    @Arg('query', () => Boolean, { nullable: true }) __?: boolean | null,
    @Arg('where', () => OrderWhere, { nullable: true }) ___?: OrderWhere | null,
  ): Order[] {
    return root;
  }
}
