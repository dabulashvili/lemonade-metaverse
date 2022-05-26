import { Arg, Args, Resolver, Info, Root, Query, Subscription, FieldResolver, Int, Ctx } from 'type-graphql';
import { ethers } from 'ethers';
import { GraphQLResolveInfo } from 'graphql';
import DataLoader from 'dataloader';

import { Context } from '../types';
import { Order, OrderComplex, OrderSort, OrderWhereComplex } from '../types/order';
import { OrderModel } from '../../app/models/order';
import { PaginationArgs } from '../types/pagination';
import { Trigger } from '../../app/helpers/pub-sub';

import { createSubscribe } from '../utils/subscription';
import { getFieldTree, getFieldProjection } from '../utils/field';
import { getFilter, validate } from '../utils/where';
import { getSort } from '../utils/sort';

const findOrders = async (
  { skip, limit, sort, where }: PaginationArgs & { sort?: OrderSort | null; where?: OrderWhereComplex | null },
  info: GraphQLResolveInfo,
  projection?: { [P in keyof OrderComplex]?: 1 },
) => {
  const fields = getFieldTree(info);
  const filterToken = where?.token ? getFilter(where.token) : {};
  const filter = where ? getFilter({ ...where, token: undefined }) : {};

  if (filterToken.id) filter.token = filterToken.id;

  return await OrderModel.aggregate([
    { $match: filter },
    ...fields.token || where?.token ? [
      {
        $lookup: {
          from: 'tokens',
          let: { network: '$network', token: '$token' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$network', '$$network'] }, { $eq: ['$id', '$$token'] }] }, ...filterToken } },
            { $limit: 1 },
          ],
          as: 'token',
        },
      },
      { $unwind: '$token' },
    ] : [],
    ...sort ? [{ $sort: getSort(sort) }] : [],
    { $skip: skip },
    { $limit: limit },
    { $project: { ...getFieldProjection(fields), ...projection } },
  ]);
};

@Resolver()
class _OrdersQueryResolver {
  @Query(() => [OrderComplex])
  async orders(
    @Info() info: GraphQLResolveInfo,
    @Args() args: PaginationArgs,
    @Arg('sort', () => OrderSort, { nullable: true }) sort?: OrderSort | null,
    @Arg('where', () => OrderWhereComplex, { nullable: true }) where?: OrderWhereComplex | null,
  ): Promise<OrderComplex[]> {
    return await findOrders({ ...args, sort, where }, info);
  }
}

@Resolver()
class _OrdersSubscriptionResolver {
  @Subscription(
    () => [OrderComplex],
    {
      subscribe: createSubscribe<OrderComplex>({
        init: async function* ({ args, info }) {
          if (args.query) yield findOrders(args, info, { network: 1, id: 1 });
        },
        restrict: () => (payload) => payload.network + payload.id,
        trigger: Trigger.OrderUpdated,
        filter: (payload, { args }) => args.where ? validate(args.where, payload) : true,
      }),
    }
  )
  orders(
    @Root() root: OrderComplex[],
    @Args() _: PaginationArgs,
    @Arg('query', () => Boolean, { nullable: true }) __?: boolean | null,
    @Arg('sort', () => OrderSort, { nullable: true }) ___?: OrderSort | null,
    @Arg('where', () => OrderWhereComplex, { nullable: true }) ____?: OrderWhereComplex | null,
  ): OrderComplex[] {
    return root;
  }
}

@Resolver(() => Order)
class _OrderResolver {
  @FieldResolver(() => Int, { nullable: true })
  async price_usd(
    @Ctx() context: Context,
    @Root() order: Order
  ) {
    if (!order.currency?.symbol) return;

    context.dataLoaders = context.dataLoaders || {};
    context.dataLoaders.price_usd = context.dataLoaders.price_usd || new DataLoader<string, string, string>(async (currencies) => {
      const res: string[] = [];

      for (const _currency of currencies) {
        res.push('2'); // LINK is 2 dollars
      }

      return res;
    });

    const val = await context.dataLoaders.price_usd.load(order.currency.symbol) as string | undefined;

    if (!val) return;

    return ethers.BigNumber.from(order.price)
      .mul(ethers.BigNumber.from(val))
      .div(ethers.constants.WeiPerEther.div(100))
      .toNumber();
  }
}
