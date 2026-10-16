import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SelectableRow } from '@goodboy/ui';
import type { Session, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, type LensKind } from '../../../../store';
import { mountRequestOf } from '../../../../store/slices/project-mounts/mountRowModel';
import { useBranchIdentity } from '../../../../features/branch/hooks/useBranchIdentity';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { switchBranchMount } from '../../../../features/branch/switchBranchMount';
import { MountProjectAction } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction';
import { LevelLabel } from './LevelLabel';

type Props = {
  readonly session: Session;
  readonly isActive: boolean;
};

type ProjectGroup = {
  readonly key: string;
  readonly name: string;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const LABEL_ID = 'level-projects-label';

const BRANCH_LENSES: ReadonlySet<LensKind | null> = new Set<LensKind | null>([
  'branch',
  'review',
  'pr',
  'files',
]);

const groupsOf = ({
  mounts,
}: {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
}): ReadonlyArray<ProjectGroup> =>
  mounts.reduce<ReadonlyArray<ProjectGroup>>((groups, mount) => {
    const existing = groups.find((group) => group.key === mount.projectId);
    if (existing === undefined) {
      return [...groups, { key: mount.projectId, name: mount.mountName, mounts: [mount] }];
    }
    return groups.map((group) =>
      group === existing ? { ...group, mounts: [...group.mounts, mount] } : group,
    );
  }, []);

export const LevelProjects = ({ session, isActive }: Props) => {
  const sessionId = session.id;
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const branch = useBranchIdentity({ sessionId });
  const isBranchShown = useAppStore((s) => BRANCH_LENSES.has(s.activeLens[sessionId] ?? null));
  const shownPath = isBranchShown ? branch.mountPath : null;
  const requestNumbers = useAppStore(
    useShallow((s) =>
      (s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY).map(
        (mount) => mountRequestOf({ state: s, mountId: mount.mountId })?.number ?? null,
      ),
    ),
  );
  const groups = useMemo(() => groupsOf({ mounts }), [mounts]);
  const isArchived = session.archivedAt != null;

  return (
    <div role="group" aria-labelledby={LABEL_ID} className="flex flex-col">
      <LevelLabel
        id={LABEL_ID}
        label="Projects"
        {...(!isArchived && {
          action: <MountProjectAction sessionId={sessionId} workspaceId={session.workspaceId} />,
        })}
      />
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col">
          <div className="flex h-7 min-w-0 items-center gap-2 px-2 text-label text-muted-foreground">
            <CONCEPT_ICONS.projectFolder size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            <span className="truncate">{group.name}</span>
          </div>
          <ul aria-label={`${group.name} worktrees`} className="flex flex-col">
            {group.mounts.map((mount) => {
              const index = mounts.indexOf(mount);
              const number = requestNumbers[index] ?? null;
              const isShown = isActive && mount.worktreePath === shownPath;
              const branch = mount.branch === '' ? mount.mountName : mount.branch;
              return (
                <li key={mount.mountId}>
                  <SelectableRow
                    selected={isShown}
                    ariaCurrent={isShown ? 'page' : undefined}
                    title={`${group.name}, ${branch}`}
                    onClick={() =>
                      void switchBranchMount({
                        sessionId,
                        mountId: mount.mountId,
                        worktreePath: mount.worktreePath,
                        mode: 'push',
                      })
                    }
                    className="h-7 items-center gap-2 px-2 text-label"
                  >
                    <CONCEPT_ICONS.branch size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-code">{branch}</span>
                    <span className="w-12 shrink-0 text-right text-meta tabular-nums text-faint-foreground">
                      {number === null ? '' : `#${number}`}
                    </span>
                  </SelectableRow>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};
