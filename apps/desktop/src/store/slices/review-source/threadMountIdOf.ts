import type { MountId, ResolveThread, SessionId } from '@goodboy/types';
import { isNoteOnBranch, noteIdOfThread } from '../../../features/resolve/notes/noteThread';
import type { AppState } from '../../types';
import { selectWritableMounts } from '../project-mounts/selectors';
import { reviewSourceEntriesOf } from './reviewSourceEntries';

type Keys =
  | keyof Parameters<typeof reviewSourceEntriesOf>[0]['state']
  | 'sessionResolveThreads'
  | 'diffComments';

type FullState = Pick<AppState, Keys>;

export type ThreadMountState = Partial<FullState>;

const NO_STATE: FullState = {
  sessions: [],
  projects: [],
  sessionProjectMounts: {},
  sessionMounts: {},
  sessionActiveProject: {},
  sessionGithub: {},
  sessionRequests: {},
  mountGithub: {},
  mountRequests: {},
  reviewSourceThreads: {},
  sessionResolveThreads: {},
  diffComments: {},
};

type Params = {
  readonly state: ThreadMountState;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly prNumber?: number | null;
};

type NoteParams = {
  readonly state: FullState;
  readonly sessionId: SessionId;
  readonly noteId: string;
};

type HostParams = {
  readonly state: FullState;
  readonly sessionId: SessionId;
  readonly row: ResolveThread | null;
  readonly prNumber: number | null;
};

const noteMountIdOf = ({ state, sessionId, noteId }: NoteParams): MountId | null => {
  const note = (state.diffComments[sessionId] ?? []).find((candidate) => candidate.id === noteId);
  if (note === undefined) {
    return null;
  }
  return (
    selectWritableMounts({ state, sessionId }).find((mount) =>
      isNoteOnBranch({ note, projectId: mount.projectId, branch: mount.branch }),
    )?.mountId ?? null
  );
};

const hostMountIdOf = ({ state, sessionId, row, prNumber }: HostParams): MountId | null => {
  const owners = new Set<MountId>();
  if (prNumber !== null) {
    for (const entry of reviewSourceEntriesOf({ state, sessionId })) {
      const isSameHost = row === null || (row.sourceKind ?? 'github') === entry.kind;
      const isSameProject =
        row?.projectId == null || entry.projectId === null || row.projectId === entry.projectId;
      if (entry.mountId !== null && entry.number === prNumber && isSameHost && isSameProject) {
        owners.add(entry.mountId);
      }
    }
  }
  const [owner] = [...owners];
  if (owners.size === 1 && owner !== undefined) {
    return owner;
  }
  if (owners.size > 1 || row?.projectId == null) {
    return null;
  }
  const inProject = selectWritableMounts({ state, sessionId }).filter(
    (mount) => mount.projectId === row.projectId,
  );
  const [sole] = inProject;
  return inProject.length === 1 && sole !== undefined ? sole.mountId : null;
};

export const threadMountIdOf = ({
  state: given,
  sessionId,
  threadId,
  prNumber = null,
}: Params): MountId | null => {
  const state: FullState = { ...NO_STATE, ...given };
  const noteId = noteIdOfThread({ threadId });
  if (noteId !== null) {
    return noteMountIdOf({ state, sessionId, noteId });
  }
  const row =
    (state.sessionResolveThreads[sessionId] ?? []).find(
      (candidate) => candidate.threadId === threadId,
    ) ?? null;
  return hostMountIdOf({ state, sessionId, row, prNumber: prNumber ?? row?.prNumber ?? null });
};
