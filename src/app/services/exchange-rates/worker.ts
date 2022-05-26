import { Job, Processor, Queue, QueueScheduler, Worker } from 'bullmq';
import { connection } from '../../helpers/bullmq';
import { logger } from '../../helpers/pino';
import { pubSub, Trigger } from '../../helpers/pub-sub';
import { getExchangeRates } from './fetcher';
import { JOB_NAME, QUEUE_NAME } from './shared';

const WORKER_CONCURRENCY = 10;
const MINUTE_IN_MILLISECONDS = 60 * 1000;

let queueScheduler: QueueScheduler | undefined;
let queue: Queue | undefined;
let worker: Worker | undefined;

const processor: Processor = async () => {
    const exchangeRates = await getExchangeRates()
    if (exchangeRates) {
        pubSub.publish(Trigger.ExchangeRateUpdated, exchangeRates);
    }
}

export const start = async () => {
    queueScheduler = new QueueScheduler(QUEUE_NAME, { connection });
    await queueScheduler.waitUntilReady();

    queue = new Queue(QUEUE_NAME);
    queue.add(JOB_NAME, {}, {
        repeat: {
            every: MINUTE_IN_MILLISECONDS,
        },
    });

    worker = new Worker(QUEUE_NAME, processor, { connection, concurrency: WORKER_CONCURRENCY });
    worker.on('failed', function onFailed(_job: Job, error) {
        logger.error(error, 'failed to fetch exchange rates.');
    });    
    await worker.waitUntilReady();
}