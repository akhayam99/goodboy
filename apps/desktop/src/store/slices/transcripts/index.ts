import { appendTurnEvent } from './appendTurnEvent';
import { loadTranscript } from './loadTranscript';
import { resetTranscript } from './resetTranscript';
import type { GetFn, SetFn } from './types';

export function createTranscriptsSlice(set: SetFn, _get: GetFn) {
  return {
    loadTranscript: loadTranscript(set),
    appendTurnEvent: appendTurnEvent(set),
    resetTranscript: resetTranscript(set),
  };
}
