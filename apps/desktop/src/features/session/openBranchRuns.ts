import type { SessionId } from '@goodboy/types';
import { openBranchWork } from './openBranchWork';

type Params = {
  readonly sessionId: SessionId;
  readonly groupKey: string;
  readonly mountPath: string | null;
};

export const openBranchRuns = ({ sessionId, groupKey, mountPath }: Params): void =>
  openBranchWork({ sessionId, lens: 'workflows', groupKey, mountPath });
