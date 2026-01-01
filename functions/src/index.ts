import { setGlobalOptions } from 'firebase-functions/v2';
import { refresh } from './refresh';
import { syncIncome } from './syncIncome';
import { syncExpenses } from './syncExpenses';

setGlobalOptions({ region: 'me-west1', concurrency: 80 });

export { refresh };
export { syncIncome, syncExpenses };
