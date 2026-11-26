import type { StopTrainAction } from '../contract/actions';
import { doneResult, refusedResult } from './handlerResults';
import type { HandlerResult, StoreHandlerParams } from './handlerTypes';

export const stopTrain = async ({
  action,
  getStore,
}: StoreHandlerParams<StopTrainAction>): Promise<HandlerResult> => {
  const store = getStore();
  const train = store.mergeTrain;
  if (train === null || train.id !== action.trainId) {
    return refusedResult({ code: 'unknown-target', message: "This train isn't running." });
  }
  if (train.outcome !== null) {
    return refusedResult({ code: 'already-decided', message: 'The train already ended.' });
  }
  store.stopMergeTrainAfterThis();
  return doneResult();
};
