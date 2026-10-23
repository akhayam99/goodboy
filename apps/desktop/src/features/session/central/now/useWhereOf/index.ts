import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useMountRows } from '../../../components/SessionOverviewPane/ProjectMountRows/useMountRows';

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
    const isProjectShown = new Set(rows.map((row) => row.projectName)).size >= 2;
    const [onlyRow] = rows;
    const whereByMountId = new Map<string, string>(
      rows.map((row) => [
        row.mountId,
        isProjectShown ? `${row.projectName} · ${row.branch}` : row.branch,
      ]),
    );
    return ({ mountId }) => {
      if (mountId !== null) {
        return whereByMountId.get(mountId) ?? null;
      }
      return rows.length === 1 && onlyRow !== undefined
        ? (whereByMountId.get(onlyRow.mountId) ?? null)
        : null;
    };
  }, [groups]);
};
