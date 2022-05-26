import { pubSub, Trigger } from '../../helpers/pub-sub';
import { ExchangeRates } from './fetcher';

let exchangeRates: ExchangeRates | undefined;

pubSub.subscribe(Trigger.ExchangeRateUpdated, (newRates) => {
    exchangeRates = newRates
});

export const getRates = async () => {
    return exchangeRates;
}