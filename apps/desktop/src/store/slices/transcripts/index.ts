import { appendTurnEvent } from './appendTurnEvent';
import type { SliceDeps } from '../../slice-types';

export const createTranscriptsSlice = ({ set }: SliceDeps) => {
  return {
    appendTurnEvent: appendTurnEvent(set),
  };
};
