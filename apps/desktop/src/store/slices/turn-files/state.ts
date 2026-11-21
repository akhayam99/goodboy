import type { SessionId } from '@goodboy/types';
import type { TurnFilesEntry } from './types';

export type TurnFilesState = {
  readonly turnFiles: Readonly<Record<SessionId, ReadonlyArray<TurnFilesEntry>>>;
};

export const turnFilesInitialState: TurnFilesState = {
  turnFiles: {},
};
