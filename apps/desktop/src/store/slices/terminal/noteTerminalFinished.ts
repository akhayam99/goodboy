import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';

import type { TerminalFinish } from './state';

type Deps = Pick<SliceDeps, 'set'>;

type NoteParams = {
  readonly sessionId: SessionId;
  readonly finish: TerminalFinish;
};

export const noteTerminalFinished = ({ set }: Deps) => {
  return ({ sessionId, finish }: NoteParams): void => {
    set((state) => ({ terminalFinishes: { ...state.terminalFinishes, [sessionId]: finish } }));
  };
};
