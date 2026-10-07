import type { SendTurnInput, SendTurnResult } from '../turn/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly input: Omit<SendTurnInput, 'onStarted'>;
  readonly onLateError: (error: unknown) => void;
};

export const refusalOf = (result: SendTurnResult): string | null => {
  if (result.blockedOverBudget) {
    return 'The session budget is reached. Raise it to continue the fix run';
  }
  if (result.isWriterLeaseDenied === true) {
    return 'Another agent is writing in this folder. Try again in a moment';
  }
  return null;
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
          reject(new Error(refusalOf(result) ?? 'The fix run did not start'));
        },
        (error: unknown) => {
          if (isStarted) {
            onLateError(error);
            return;
          }
          reject(error);
        },
      );
  });
