import type { SessionId } from '@goodboy/types';
import type { AutoViewState } from './state';

type LoadAutoTreesParams = {
  readonly sessionId: SessionId;
};

export type AutoViewSlice = AutoViewState & {
  loadAutoTrees(params: LoadAutoTreesParams): Promise<void>;
};
