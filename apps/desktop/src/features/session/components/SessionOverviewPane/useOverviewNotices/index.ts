import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Project, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useLapProject } from '../../../../bootstrap/useLapProject';
import type { RemoteBranchState } from '../../../../worktree/worktree';
import { useWorktreeStatusSnapshot } from '../../../hooks/useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../../../hooks/useWorktreeStatuses/targets';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { liveDismissalsOf } from '../liveDismissalsOf';
import { mismatchDismissalKeyOf } from '../mismatchDismissalKeyOf';
import { overviewNoticesOf, type OverviewNotice } from '../overviewNoticesOf';
import { useForeignCommitsByMount } from '../ProjectMountRows/useForeignCommitsByMount';
import { useMountRows } from '../ProjectMountRows/useMountRows';

type Params = {
  readonly sessionId: SessionId;
  readonly isEnabled: boolean;
};

type MountParams = {
  readonly mountId: string;
};

type StatusParams = {
  readonly row: MountRowView;
};

export type OverviewNoticesView = {
  readonly rows: ReadonlyArray<MountRowView>;
  readonly lapProject: Project | null;
  readonly lapStage: 'first-lap' | 'moving' | null;
  readonly isPublishShown: boolean;
  readonly statusOf: (params: StatusParams) => WorktreeStatus | null;
  readonly foreignOf: (params: MountParams) => RemoteBranchState | null;
  readonly isDismissed: (params: StatusParams) => boolean;
  readonly dismiss: (params: StatusParams) => void;
  readonly notices: ReadonlyArray<OverviewNotice>;
};

const NO_ROWS: ReadonlyArray<MountRowView> = [];

export const useOverviewNotices = ({ sessionId, isEnabled }: Params): OverviewNoticesView => {
  const groups = useMountRows({ sessionId });
  const lap = useLapProject({ sessionId });
  const projects = useAppStore((state) => state.projects);
  const probe = useAppStore((state) =>
    lap.project === null ? null : (state.bootstrapRemoteProbe[lap.project.id]?.probe ?? null),
  );
  const rows = useMemo(
    () => (isEnabled ? groups.flatMap((group) => group.rows) : NO_ROWS),
    [groups, isEnabled],
  );
  const targets = useMemo(
    () => worktreeStatusTargetsOf({ mounts: rows, projects }),
    [projects, rows],
  );
  const worktrees = useWorktreeStatusSnapshot({ targets });
  const [dismissedKeys, setDismissedKeys] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    setDismissedKeys((current) => liveDismissalsOf({ dismissedKeys: current, rows }));
  }, [rows]);
  const statusOf = useCallback(
    ({ row }: StatusParams): WorktreeStatus | null =>
      row.worktreePath === null ? null : (worktrees.statuses.get(row.worktreePath) ?? null),
    [worktrees.statuses],
  );
  const foreignByMount = useForeignCommitsByMount({ rows, statusOf });
  const isPublishShown =
    isEnabled &&
    lap.project !== null &&
    lap.stage !== null &&
    lap.stage !== 'moving' &&
    groups.length === 0 &&
    probe?.kind !== 'main-present';
  const foreignMountIds = useMemo(() => new Set(foreignByMount.keys()), [foreignByMount]);
  const notices = useMemo(
    () =>
      overviewNoticesOf({
        rows,
        statusOf,
        foreignMountIds,
        dismissedKeys,
        isPublishShown,
      }),
    [dismissedKeys, foreignMountIds, isPublishShown, rows, statusOf],
  );
  const foreignOf = useCallback(
    ({ mountId }: MountParams) => foreignByMount.get(mountId) ?? null,
    [foreignByMount],
  );
  const isDismissed = useCallback(
    ({ row }: StatusParams) =>
      row.observation !== null &&
      dismissedKeys.has(mismatchDismissalKeyOf({ observation: row.observation })),
    [dismissedKeys],
  );
  const dismiss = useCallback(({ row }: StatusParams) => {
    const observation = row.observation;
    if (observation === null) {
      return;
    }
    setDismissedKeys((current) => new Set(current).add(mismatchDismissalKeyOf({ observation })));
  }, []);

  return {
    rows,
    lapProject: lap.project,
    lapStage: lap.stage,
    isPublishShown,
    statusOf,
    foreignOf,
    isDismissed,
    dismiss,
    notices,
  };
};
