import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useMountRows } from '../../../components/SessionOverviewPane/ProjectMountRows/useMountRows';

type Params = {
  readonly sessionId: SessionId;
};

export type BranchLabel = {
  readonly projectName: string;
  readonly branch: string;
};

type OfParams = {
  readonly mountId: string | null;
};

export type BranchLabelOf = (params: OfParams) => BranchLabel | null;

const MIN_BRANCHES = 2;

export const useBranchLabels = ({ sessionId }: Params): BranchLabelOf => {
  const groups = useMountRows({ sessionId });
  return useMemo(() => {
    const rows = groups.flatMap((group) => group.rows);
    const labels = new Map<string, BranchLabel>(
      rows.map((row) => [row.mountId, { projectName: row.projectName, branch: row.branch }]),
    );
    return ({ mountId }) =>
      rows.length < MIN_BRANCHES || mountId === null ? null : (labels.get(mountId) ?? null);
  }, [groups]);
};
