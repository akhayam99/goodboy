import { useMemo } from 'react';
import { StatusDot, Tooltip, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useMountDiffStats } from '../../../../store';
import { useBranchIdentity } from '../../../../features/branch/hooks/useBranchIdentity';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import { useMountRows } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/useMountRows';
import { useWorktreeStatusSnapshot } from '../../../../features/session/hooks/useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../../../../features/session/hooks/useWorktreeStatuses/targets';
import { BRANCH_LENSES } from '../branchLenses';
import { useLapProject } from '../../../../features/bootstrap/useLapProject';
import { MountProjectAction } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction';
import { RebaseAllCard } from '../../../../features/history/RebaseAllCard';
import { rebaseAllBatchSettledOf } from '../../../../features/history/RebaseAllCard/rebaseAllBatchSettledOf';
import { useRebaseStatuses } from '../../../../features/history/useRebaseStatuses';
import { LevelCard } from './LevelCard';
import { ProjectTree } from './ProjectTree';
import { CARD_ROW_INSET } from './railInset';
import { useLevelCardFold } from './useLevelCardFold';
import { useProjectsSignal } from './useProjectsSignal';
import { useRailTreeOpen } from './useRailTreeOpen';

type Props = {
  readonly session: Session;
  readonly isActive: boolean;
};

const LABEL_ID = 'level-projects-label';

export const LevelProjects = ({ session, isActive }: Props) => {
  const sessionId = session.id;
  const groups = useMountRows({ sessionId });
  const projects = useAppStore((state) => state.projects);
  const branch = useBranchIdentity({ sessionId });
  const isBranchShown = useAppStore((s) => BRANCH_LENSES.has(s.activeLens[sessionId] ?? null));
  const openedPath = isBranchShown ? branch.mountPath : null;
  const shownPath = isActive ? openedPath : null;
  const fold = useLevelCardFold({ card: 'projects' });
  const tree = useRailTreeOpen({ sessionId });
  const liveRows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const targets = useMemo(
    () =>
      worktreeStatusTargetsOf({
        mounts: groups.flatMap((group) => [...group.rows, ...group.finishedRows]),
        projects,
      }),
    [groups, projects],
  );
  const snapshot = useWorktreeStatusSnapshot({ targets });
  const diffStats = useMountDiffStats(sessionId);
  useRebaseStatuses({ sessionId });
  const signal = useProjectsSignal({ sessionId, rows: liveRows, statuses: snapshot.statuses });
  const run = useAppStore((state) => state.rebaseAllRuns[sessionId] ?? null);
  const isBatchSettled = rebaseAllBatchSettledOf({
    run,
    rows: liveRows,
    statuses: snapshot.statuses,
  });
  const isArchived = session.archivedAt != null;
  const lap = useLapProject({ sessionId });
  const lapName = groups.length === 0 && lap.stage !== null ? (lap.project?.name ?? null) : null;

  return (
    <LevelCard
      id={LABEL_ID}
      label={NAMES.projects}
      isOpen={fold.isOpen}
      onToggle={fold.toggle}
      {...(signal.tone !== null && {
        meta: (
          <Tooltip content={signal.reason}>
            <span data-card-signal="" className="flex">
              <StatusDot tone={signal.tone} size="sm" />
            </span>
          </Tooltip>
        ),
      })}
      {...(!isArchived && {
        action: (
          <MountProjectAction
            sessionId={sessionId}
            workspaceId={session.workspaceId}
            presentation="add"
          />
        ),
      })}
    >
      <RebaseAllCard sessionId={sessionId} />
      {lapName === null ? null : (
        <div
          data-lap-project=""
          className={cn(
            'flex h-7 min-w-0 items-center gap-2 text-ui text-muted-foreground',
            CARD_ROW_INSET,
          )}
        >
          <CONCEPT_ICONS.projectFolder size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="truncate">{lapName}</span>
        </div>
      )}
      {groups.length === 0 ? null : (
        <div data-card-projects="" className="flex min-w-0 flex-col gap-3">
          {groups.map((group) => (
            <ProjectTree
              key={group.projectId}
              sessionId={sessionId}
              group={group}
              tree={tree}
              statuses={snapshot.statuses}
              diffStats={diffStats}
              shownPath={shownPath}
              openedPath={openedPath}
              isBatchSettled={isBatchSettled}
            />
          ))}
        </div>
      )}
    </LevelCard>
  );
};
