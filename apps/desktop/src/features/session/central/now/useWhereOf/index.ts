import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useMountRows } from '../../../../../shared/hooks/useMountRows';

type Params = {
  readonly sessionId: SessionId;
};

type OfParams = {
  readonly mountId: string | null;
};

export type WhereOf = (params: OfParams) => string | null;

export const useWhereOf = ({ sessionId }: Params): WhereOf => {
  const groups = useMountRows({ sessionId });
  return useMemo(() => {
    const rows = groups.flatMap((group) => group.rows);
    if (rows.length < 2) {
      return () => null;
    }
    const isProjectShown = new Set(rows.map((row) => row.projectName)).size >= 2;
    const whereByMountId = new Map<string, string>(
      rows.map((row) => [
        row.mountId,
        isProjectShown ? `${row.projectName} · ${row.branch}` : row.branch,
      ]),
    );
    return ({ mountId }) => (mountId === null ? null : (whereByMountId.get(mountId) ?? null));
  }, [groups]);
};
