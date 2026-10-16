import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useLapProject } from '../../../bootstrap/useLapProject';
import { useWorktreeStatusSnapshot } from '../../hooks/useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../../hooks/useWorktreeStatuses/targets';
import { LapPublishNotice } from './ProjectMountRows/LapPublishNotice';
import { useMountRows } from './ProjectMountRows/useMountRows';
import { MountNotices } from './MountNotices';

type Props = {
  readonly session: Session;
};

export const OverviewNotices = ({ session }: Props) => {
  const sessionId = session.id;
  const groups = useMountRows({ sessionId });
  const lap = useLapProject({ sessionId });
  const projects = useAppStore((state) => state.projects);
  const rows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const targets = useMemo(
    () => worktreeStatusTargetsOf({ mounts: rows, projects }),
    [projects, rows],
  );
  const worktrees = useWorktreeStatusSnapshot({ targets });

  return (
    <section
      aria-label="Notices"
      data-overview-notices=""
      className="flex min-w-0 flex-col gap-2 empty:hidden"
    >
      {lap.project !== null && lap.stage !== null && groups.length === 0 ? (
        <LapPublishNotice sessionId={sessionId} project={lap.project} stage={lap.stage} />
      ) : null}
      {rows.map((row) => (
        <MountNotices
          key={row.mountId}
          sessionId={sessionId}
          row={row}
          status={
            row.worktreePath === null ? null : (worktrees.statuses.get(row.worktreePath) ?? null)
          }
        />
      ))}
    </section>
  );
};
