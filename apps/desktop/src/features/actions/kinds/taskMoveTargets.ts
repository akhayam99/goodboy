import type { ProjectId, SessionExternalTask, SessionProjectMount } from '@goodboy/types';
import type { TaskMoveTarget } from '../../../store/slices/sessions/moveSessionExternalTask';

export const SESSION_CHOICE_ID = 'session';

const BRANCH_LABEL_LIMIT = 36;

export type TaskMoveChoice = {
  readonly id: string;
  readonly label: string;
  readonly isCurrent: boolean;
  readonly to: TaskMoveTarget;
};

type Params = {
  readonly rows: ReadonlyArray<SessionExternalTask>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly projectName: (projectId: ProjectId) => string | null;
  readonly branch: string | null;
};

type PlaceParams = {
  readonly projectId: ProjectId | null;
  readonly branch: string;
};

type PlaceOnly = {
  readonly place: PlaceParams;
};

const cutMiddle = (text: string): string => {
  if (text.length <= BRANCH_LABEL_LIMIT) {
    return text;
  }
  const keep = Math.floor((BRANCH_LABEL_LIMIT - 1) / 2);
  return `${text.slice(0, keep)}…${text.slice(text.length - keep)}`;
};

const choiceIdOf = ({ projectId, branch }: PlaceParams): string =>
  `branch:${projectId ?? ''}:${branch}`;

export const taskMoveTargets = ({
  rows,
  mounts,
  projectName,
  branch,
}: Params): ReadonlyArray<TaskMoveChoice> => {
  const anchor = rows[0];
  if (anchor === undefined) {
    return [];
  }
  const sessionRows = rows.filter((row) => row.scope !== 'branch');
  const branchRows = rows.filter((row) => row.scope === 'branch' && row.branch !== undefined);
  const hasSession = sessionRows.length > 0;
  const open = mounts.filter(
    (mount) =>
      mount.isAttached && (anchor.projectId == null || mount.projectId === anchor.projectId),
  );
  const places = new Map<string, PlaceParams>();
  for (const mount of open) {
    const place = { projectId: mount.projectId, branch: mount.branch };
    places.set(choiceIdOf(place), place);
  }
  for (const row of branchRows) {
    const placed = row.branch ?? '';
    const projectId =
      row.projectId ?? mounts.find((mount) => mount.branch === placed)?.projectId ?? null;
    const place = { projectId, branch: placed };
    places.set(choiceIdOf(place), place);
  }
  const isHeld = ({ place }: PlaceOnly): boolean =>
    branchRows.some(
      (row) =>
        row.branch === place.branch &&
        (row.projectId == null || place.projectId === null || row.projectId === place.projectId),
    );
  const isCurrentBranch = ({ place }: PlaceOnly): boolean =>
    branch === null
      ? !hasSession && isHeld({ place })
      : place.branch === branch && isHeld({ place });
  const branches = [...places.values()].map((place): TaskMoveChoice => {
    const name = place.projectId === null ? null : projectName(place.projectId);
    const label = cutMiddle(place.branch);
    return {
      id: choiceIdOf(place),
      label: name === null ? label : `${name} · ${label}`,
      isCurrent: isCurrentBranch({ place }),
      to: { kind: 'branch', projectId: place.projectId, branch: place.branch },
    };
  });
  return [
    {
      id: SESSION_CHOICE_ID,
      label: 'This session',
      isCurrent: branch === null && hasSession,
      to: { kind: 'session' },
    },
    ...branches,
  ];
};
