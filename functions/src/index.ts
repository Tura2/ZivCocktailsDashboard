import { setGlobalOptions } from 'firebase-functions/v2';
import { refresh } from './refresh';

setGlobalOptions({ region: 'me-west1', concurrency: 80 });

export { refresh };
