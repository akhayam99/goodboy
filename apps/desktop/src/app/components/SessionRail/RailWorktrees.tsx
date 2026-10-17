import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useBranchIdentity } from '../../../features/branch/hooks/useBranchIdentity';
import { useMountRows } from '../../../features/session/components/SessionOverviewPane/ProjectMountRows/useMountRows';
import { useWorktreeStatusSnapshot } from '../../../features/session/hooks/useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../../../features/session/hooks/useWorktreeStatuses/targets';
import { BRANCH_LENSES } from './branchLenses';
import { RailWorktreeButton } from './RailWorktreeButton';

type Props = {
  readonly session: Session;
};

export const RailWorktrees = ({ session }: Props) => {
  const sessionId = session.id;
  const groups = useMountRows({ sessionId });
  const projects = useAppStore((state) => state.projects);
  const branch = useBranchIdentity({ sessionId });
  const isBranchShown = useAppStore((s) => BRANCH_LENSES.has(s.activeLens[sessionId] ?? null));
  const shownPath = isBranchShown ? branch.mountPath : null;
  const rows = useMemo(
    () => groups.flatMap((group) => [...group.rows, ...group.finishedRows]),
    [groups],
  );
  const targets = useMemo(
    () => worktreeStatusTargetsOf({ mounts: rows, projects }),
    [rows, projects],
  );
  const snapshot = useWorktreeStatusSnapshot({ targets });
  if (rows.length === 0) {
    return null;
  }
  return (
    <div data-rail-worktrees="" className="flex flex-col">
      {rows.map((row) => (
        <RailWorktreeButton
          key={row.mountId}
          sessionId={sessionId}
          row={row}
          status={
            row.worktreePath === null ? null : (snapshot.statuses.get(row.worktreePath) ?? null)
          }
          isShown={row.worktreePath !== null && row.worktreePath === shownPath}
        />
      ))}
    </div>
  );
};
