import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { isOpenRequest } from '../../../../../store/slices/project-mounts/mountRowModel';
import { useMountRows } from '../../../components/SessionOverviewPane/ProjectMountRows/useMountRows';
import type { NextBranchName } from '../../next/nextRowCopyOf';

type Params = {
  readonly sessionId: SessionId;
};

type OfParams = {
  readonly mountId: string | null;
};

export type BranchNameOf = (params: OfParams) => NextBranchName | null;

export const useBranchNames = ({ sessionId }: Params): BranchNameOf => {
  const groups = useMountRows({ sessionId });
  return useMemo(() => {
    const names = new Map<string, NextBranchName>(
      groups.flatMap((group) =>
        group.rows.map((row) => [
          row.mountId,
          {
            branch: row.branch,
            request: isOpenRequest({ request: row.request }) ? (row.request?.label ?? null) : null,
          },
        ]),
      ),
    );
    return ({ mountId }) => (mountId === null ? null : (names.get(mountId) ?? null));
  }, [groups]);
};
