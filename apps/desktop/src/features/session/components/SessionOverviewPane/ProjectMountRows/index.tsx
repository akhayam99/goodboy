import { useEffect, useMemo } from 'react';
import { SectionHeader } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useMountDiffStats } from '../../../../../store';
import { MountCleanupProposals } from '../MountCleanupProposals';
import { MountProjectAction } from './MountProjectAction';
import { ArchivedGate } from '../ArchivedGate';
import { ProjectMountGroup } from './ProjectMountGroup';
import { useMountRows } from './useMountRows';
import { useWorktreeStatusPending, useWorktreeStatuses } from '../../../hooks/useWorktreeStatuses';
import {
  PROJECTS_EXPLAINER,
  PROJECTS_HINT_DISMISSED_KEY,
  shouldDismissProjectsHint,
  shouldShowProjectsHint,
} from './projectsHintSettings';

type Props = {
  readonly session: Session;
  readonly isHiddenWhenEmpty?: boolean;
};

const NO_PROJECT_HINT = 'No project yet. Turns run in the session folder until you add one.';

export const ProjectMountRows = ({ session, isHiddenWhenEmpty = false }: Props) => {
  const groups = useMountRows({ sessionId: session.id });
  const loadSessionMounts = useAppStore((state) => state.loadSessionMounts);
  const loadPrSeries = useAppStore((state) => state.loadPrSeries);
  const hasDetectedEditors = useAppStore((state) => state.detectedEditors.length > 0);
  const loadDetectedEditors = useAppStore((state) => state.loadDetectedEditors);
  const diffStats = useMountDiffStats(session.id);
  const settings = useAppStore((state) => state.settings);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const areMountsLoaded = useAppStore(
    (state) => state.sessionProjectMounts[session.id] !== undefined,
  );
  const worktreeTargets = useMemo(
    () =>
      groups.flatMap((group) =>
        [...group.rows, ...group.completedRows].flatMap((row) =>
          row.worktreePath === null || !row.isAttached
            ? []
            : [{ worktreePath: row.worktreePath, baseBranch: row.baseBranch ?? undefined }],
        ),
      ),
    [groups],
  );
  const worktreeStatuses = useWorktreeStatuses({ targets: worktreeTargets });
  const pendingWorktrees = useWorktreeStatusPending({ targets: worktreeTargets });
  const worktreeCount = worktreeTargets.length;
  const showProjectsHint = shouldShowProjectsHint({ settings, worktreeCount });

  useEffect(() => {
    if (!hasDetectedEditors) {
      void loadDetectedEditors();
    }
  }, [hasDetectedEditors, loadDetectedEditors]);

  useEffect(() => {
    void loadSessionMounts({ sessionId: session.id }).catch(() => undefined);
    void loadPrSeries({ sessionId: session.id }).catch(() => undefined);
  }, [session.id]);

  useEffect(() => {
    if (shouldDismissProjectsHint({ settings, worktreeCount })) {
      void saveSetting(PROJECTS_HINT_DISMISSED_KEY, 'true').catch(() => undefined);
    }
  }, [saveSetting, settings, worktreeCount]);

  if (isHiddenWhenEmpty && groups.length === 0) {
    return null;
  }

  return (
    <section aria-label="Projects" className="flex min-w-0 flex-col gap-2">
      <SectionHeader
        label="Projects"
        {...(areMountsLoaded && groups.length === 0
          ? { hint: NO_PROJECT_HINT }
          : showProjectsHint
            ? { hint: PROJECTS_EXPLAINER }
            : {})}
        action={
          <ArchivedGate isArchived={session.archivedAt != null}>
            <MountProjectAction
              sessionId={session.id}
              workspaceId={session.workspaceId}
              presentation="button"
            />
          </ArchivedGate>
        }
      />
      {groups.length === 0 ? null : (
        <div className="@container min-w-0">
          <div className="grid grid-cols-[minmax(10rem,1fr)_repeat(6,auto)] gap-y-3">
            {groups.map((group) => (
              <ProjectMountGroup
                key={group.projectId}
                sessionId={session.id}
                group={group}
                diffStats={diffStats}
                worktreeStatuses={worktreeStatuses}
                pendingWorktrees={pendingWorktrees}
              />
            ))}
          </div>
        </div>
      )}
      <MountCleanupProposals sessionId={session.id} />
    </section>
  );
};
