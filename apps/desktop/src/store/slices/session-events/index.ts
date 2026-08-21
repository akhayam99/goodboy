import { loadSessionEvents } from './loadSessionEvents';
import { recordSessionEvent } from './recordSessionEvent';
import type { GetFn, SetFn } from './types';

export const createSessionEventsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadSessionEvents: loadSessionEvents(set, get),
    recordSessionEvent: recordSessionEvent(set),
  };
};
