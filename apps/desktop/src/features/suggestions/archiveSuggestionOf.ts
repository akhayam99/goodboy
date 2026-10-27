import type { SessionId } from '@goodboy/types';
import type { SessionSuggestion } from './types';

export type SettledBranches = {
  readonly merged: number;
  readonly closed: number;
};

type Params = {
  readonly sessionId: SessionId;
  readonly settled: SettledBranches;
  readonly isBusy: boolean;
};

const archiveReasonOf = ({ merged, closed }: SettledBranches): string => {
  if (closed === 0) {
    return 'All branches merged';
  }
  return merged === 0 ? 'All branches closed' : 'All branches merged or closed';
};

export const archiveSuggestionOf = ({
  sessionId,
  settled,
  isBusy,
}: Params): SessionSuggestion | null => {
  const branchCount = settled.merged + settled.closed;
  if (branchCount === 0 || isBusy) {
    return null;
  }
  return {
    id: `archive-session:${sessionId}`,
    kind: 'archive-session',
    priority: 52,
    band: 3,
    title: 'Archive this session',
    detail: archiveReasonOf(settled),
    sessionId,
    targetKey: `archive:${sessionId}`,
    fingerprint: `archive-session:${sessionId}:${branchCount}`,
    payload: { branchCount },
  };
};
