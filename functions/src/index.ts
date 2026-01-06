import { setGlobalOptions } from 'firebase-functions/v2';
import { refresh } from './refresh';
import { syncIncome } from './syncIncome';
import { syncExpenses } from './syncExpenses';
import { salaries } from './salaries';
import { salarySave } from './salarySave';
import { salaryAccept } from './salaryAccept';
import { salaryPay } from './salaryPay';
import { salaryHistory } from './salaryHistory';

setGlobalOptions({ region: 'me-west1', concurrency: 80 });

export { refresh };
export { syncIncome, syncExpenses };
export { salaries, salarySave, salaryAccept, salaryPay, salaryHistory };
