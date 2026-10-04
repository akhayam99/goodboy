import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Band, EmptyLine, IconButton, SectionHeader } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useMountDiffStats } from '../../../../../store';
import { MountCleanupProposals } from '../MountCleanupProposals';
import { MountProjectAction } from './MountProjectAction';
import { ArchivedGate } from '../ArchivedGate';
import { ProjectMountGroup } from './ProjectMountGroup';
import { LapProjectRow } from './LapProjectRow';
import { useMountRows } from './useMountRows';
import { useWorktreeStatusSnapshot } from '../../../hooks/useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../../../hooks/useWorktreeStatuses/targets';
import { useSessionSkeleton } from '../../../hooks/useSessionSkeleton';
import { useLapProject } from '../../../../bootstrap/useLapProject';
import {
  PROJECTS_EXPLAINER,
  PROJECTS_HINT_DISMISSED_KEY,
  shouldDismissProjectsHint,
  shouldShowProjectsHint,
} from './projectsHintSettings';

type Props = {
  readonly session: Session;
};

const NO_PROJECT_LINE = 'No project yet. Turns run in the session folder until you add one.';

const FOLD_OVER_OPEN_WORKTREES = 4;

export const ProjectMountRows = ({ session }: Props) => {
  const groups = useMountRows({ sessionId: session.id });
  const lap = useLapProject({ sessionId: session.id });
  const isSkeleton = useSessionSkeleton({ sessionId: session.id });
  const loadSessionMounts = useAppStore((state) => state.loadSessionMounts);
  const loadPrSeries = useAppStore((state) => state.loadPrSeries);
  const hasDetectedEditors = useAppStore((state) => state.detectedEditors.length > 0);
  const loadDetectedEditors = useAppStore((state) => state.loadDetectedEditors);
  const diffStats = useMountDiffStats(session.id);
  const isHintDismissed = useAppStore(
    (state) => (state.settings ?? {})[PROJECTS_HINT_DISMISSED_KEY] === 'true',
  );
  const saveSetting = useAppStore((state) => state.saveSetting);
  const areMountsLoaded = useAppStore(
    (state) => state.sessionProjectMounts[session.id] !== undefined,
  );
  const projects = useAppStore((state) => state.projects);
  const worktreeTargets = useMemo(
    () =>
      worktreeStatusTargetsOf({
        mounts: groups.flatMap((group) => [...group.rows, ...group.completedRows]),
        projects,
      }),
    [groups, projects],
  );
  const worktrees = useWorktreeStatusSnapshot({ targets: worktreeTargets });
  const worktreeCount = worktreeTargets.length;
  const settings: Readonly<Record<string, string>> = isHintDismissed
    ? { [PROJECTS_HINT_DISMISSED_KEY]: 'true' }
    : {};
  const hasLapRow = lap.project !== null && lap.stage !== null && groups.length === 0;
  const showProjectsHint = shouldShowProjectsHint({
    settings,
    worktreeCount: hasLapRow ? 1 : worktreeCount,
  });
  const openWorktreeCount = groups.reduce((count, group) => count + group.rows.length, 0);
  const isFolded = openWorktreeCount > FOLD_OVER_OPEN_WORKTREES;

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
  }, [isHintDismissed, saveSetting, worktreeCount]);

  const dismissHint = () => {
    void saveSetting(PROJECTS_HINT_DISMISSED_KEY, 'true').catch(() => undefined);
  };

  return (
    <Band inset="content" ariaLabel="Projects">
      <SectionHeader
        label="Projects"
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
      {showProjectsHint ? (
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 text-meta text-muted-foreground">{PROJECTS_EXPLAINER}</p>
          <IconButton
            variant="ghost"
            icon={X}
            label="Dismiss"
            onClick={dismissHint}
            className="size-6 shrink-0"
          />
        </div>
      ) : null}
      {hasLapRow && lap.project !== null && lap.stage !== null ? (
        <LapProjectRow sessionId={session.id} project={lap.project} stage={lap.stage} />
      ) : null}
      {areMountsLoaded && groups.length === 0 && !hasLapRow ? (
        <EmptyLine>{NO_PROJECT_LINE}</EmptyLine>
      ) : null}
      {groups.length === 0 ? null : (
        <div className="@container min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] gap-y-2">
            {groups.map((group) => (
              <ProjectMountGroup
                key={group.projectId}
                sessionId={session.id}
                group={group}
                diffStats={diffStats}
                worktreeStatuses={worktrees.statuses}
                pendingWorktrees={worktrees.pending}
                isFolded={isFolded}
                isSkeleton={isSkeleton}
              />
            ))}
          </div>
        </div>
      )}
      <MountCleanupProposals sessionId={session.id} />
    </Band>
  );
};
