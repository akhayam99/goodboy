import type { SendTurnInput } from '../turn/types';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly input: Omit<SendTurnInput, 'onStarted'>;
  readonly onLateError: (error: unknown) => void;
};

export const sendUntilStarted = ({ get, input, onLateError }: Params): Promise<boolean> =>
  new Promise<boolean>((resolve, reject) => {
    let isStarted = false;
    get()
      .sendTurn({
        ...input,
        onStarted: () => {
          isStarted = true;
          resolve(true);
        },
      })
      .then(
        (result) => {
          if (isStarted) {
            return;
          }
          if (result.isLaneQueued === true) {
            resolve(false);
            return;
          }
          throwIfRefused({ result });
          reject(new Error('The fix run did not start'));
        },
        (error: unknown) => {
          if (isStarted) {
            onLateError(error);
            return;
          }
          reject(error);
        },
      )
      .catch(reject);
  });
