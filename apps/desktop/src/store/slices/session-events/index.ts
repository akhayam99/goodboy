import { loadSessionEvents } from './loadSessionEvents';
import { recordSessionEvent } from './recordSessionEvent';
import { recordSessionEventOnce } from './recordSessionEventOnce';
import type { SliceDeps } from '../../slice-types';

export const createSessionEventsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadSessionEvents: loadSessionEvents(set, get),
    recordSessionEvent: recordSessionEvent(set, get),
    recordSessionEventOnce: recordSessionEventOnce(get),
  };
};
