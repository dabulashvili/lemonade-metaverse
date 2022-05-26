import { OrderModel } from '../../models/order';

export const getUsedCryptoAssetNames = async (): Promise<string[]> => {
    return await OrderModel.distinct('currency.symbol');
}