import { exchangeRateServiceKey, exchangeRateServiceUrl } from '../../../config'
import { getUsedCryptoAssetNames } from './crypto-assets'
import { URLSearchParams } from 'url'
import fetch from 'node-fetch'
import { logger } from '../../helpers/pino'

export type ExchangeRates = {
    [K: string]: {
        [K: string]: number
    }
}

export const getExchangeRates = async (): Promise<ExchangeRates | undefined> => {
    const cryptoAssets = await getUsedCryptoAssetNames()
    if (!cryptoAssets.length) return;
    const params = new URLSearchParams([
        ['api_key', exchangeRateServiceKey],
        ['fsyms', cryptoAssets.join(',')],
        ['tsyms', 'USD,EUR'],
    ])

    const url = `${exchangeRateServiceUrl}?${params.toString()}`

    try {
        const response = await fetch(url);
        return response.json()
    } catch(err) {
        logger.error(err, `Problem with exchange rate service. Error callint ${url}`)
    }
}