import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useBranchIdentity } from '../../../../features/branch/hooks/useBranchIdentity';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useMountRows } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/useMountRows';
import { useWorktreeStatusSnapshot } from '../../../../features/session/hooks/useWorktreeStatuses';
import { worktreeStatusTargetsOf } from '../../../../features/session/hooks/useWorktreeStatuses/targets';
import { BRANCH_LENSES } from '../branchLenses';
import { FinishedWorktrees } from './FinishedWorktrees';
import { LevelAddMenu, type BranchableProject } from './LevelAddMenu';
import { LevelLabel } from './LevelLabel';
import { WorktreeRow } from './WorktreeRow';

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
  const shownPath = isActive && isBranchShown ? branch.mountPath : null;
  const targets = useMemo(
    () =>
      worktreeStatusTargetsOf({
        mounts: groups.flatMap((group) => [...group.rows, ...group.finishedRows]),
        projects,
      }),
    [groups, projects],
  );
  const snapshot = useWorktreeStatusSnapshot({ targets });
  const branchable = useMemo<ReadonlyArray<BranchableProject>>(
    () =>
      groups
        .filter((group) => group.projectKind === 'repo')
        .map((group) => ({ projectId: group.projectId, projectName: group.projectName })),
    [groups],
  );
  const isArchived = session.archivedAt != null;

  return (
    <div role="group" aria-labelledby={LABEL_ID} className="flex flex-col">
      <LevelLabel
        id={LABEL_ID}
        label="Projects"
        {...(!isArchived && {
          action: (
            <LevelAddMenu
              sessionId={sessionId}
              workspaceId={session.workspaceId}
              projects={branchable}
            />
          ),
        })}
      />
      {groups.map((group) => (
        <div key={group.projectId} className="flex flex-col">
          <div className="flex h-7 min-w-0 items-center gap-2 px-2 text-ui text-muted-foreground">
            <CONCEPT_ICONS.projectFolder size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            <span className="truncate">{group.projectName}</span>
          </div>
          <ul aria-label={`${group.projectName} worktrees`} className="flex flex-col">
            {group.rows.map((row) => (
              <li key={row.mountId}>
                <WorktreeRow
                  sessionId={sessionId}
                  row={row}
                  status={
                    row.worktreePath === null
                      ? null
                      : (snapshot.statuses.get(row.worktreePath) ?? null)
                  }
                  isShown={row.worktreePath !== null && row.worktreePath === shownPath}
                />
              </li>
            ))}
            <FinishedWorktrees
              sessionId={sessionId}
              projectName={group.projectName}
              rows={group.finishedRows}
              statuses={snapshot.statuses}
              shownPath={shownPath}
            />
          </ul>
        </div>
      ))}
    </div>
  );
};
