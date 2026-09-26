import { appendTurnEvent } from './appendTurnEvent';
import type { GetFn, SetFn } from './types';

export const createTranscriptsSlice = (set: SetFn, _get: GetFn) => {
  return {
    appendTurnEvent: appendTurnEvent(set),
  };
};
