import { useMemo } from 'react';
import { StatusDot, Tooltip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useMountDiffStats } from '../../../../store';
import { useBranchIdentity } from '../../../../features/branch/hooks/useBranchIdentity';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useMountRows } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/useMountRows';
import { useWorktreeStatusSnapshot } from '../../../../features/session/hooks/useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../../../../features/session/hooks/useWorktreeStatuses/targets';
import { BRANCH_LENSES } from '../branchLenses';
import { useLapProject } from '../../../../features/bootstrap/useLapProject';
import { LevelAddMenu, type BranchableProject } from './LevelAddMenu';
import { LevelCard } from './LevelCard';
import { ProjectTree } from './ProjectTree';
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
  const signal = useProjectsSignal({ sessionId, rows: liveRows, statuses: snapshot.statuses });
  const branchable = useMemo<ReadonlyArray<BranchableProject>>(
    () =>
      groups
        .filter((group) => group.projectKind === 'repo')
        .map((group) => ({ projectId: group.projectId, projectName: group.projectName })),
    [groups],
  );
  const isArchived = session.archivedAt != null;
  const lap = useLapProject({ sessionId });
  const lapName = groups.length === 0 && lap.stage !== null ? (lap.project?.name ?? null) : null;

  return (
    <LevelCard
      id={LABEL_ID}
      label="Projects"
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
          <LevelAddMenu
            sessionId={sessionId}
            workspaceId={session.workspaceId}
            projects={branchable}
          />
        ),
      })}
    >
      {lapName === null ? null : (
        <div
          data-lap-project=""
          className="flex h-7 min-w-0 items-center gap-2 px-2 text-ui text-muted-foreground"
        >
          <CONCEPT_ICONS.projectFolder size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="truncate">{lapName}</span>
        </div>
      )}
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
        />
      ))}
    </LevelCard>
  );
};
