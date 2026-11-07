import { ownedMountsOf, type OwnedMount } from '../../../features/monitoring/ownedMountsOf';
import type { AppStore } from '../../store';

type Input = Pick<AppStore, 'sessions' | 'sessionMounts' | 'sessionProjectMounts'>;

type Memo = {
  readonly input: Input;
  readonly mounts: ReadonlyArray<OwnedMount>;
};

let memo: Memo | null = null;

type InputPair = {
  readonly a: Input;
  readonly b: Input;
};

const isSameInput = ({ a, b }: InputPair): boolean =>
  a.sessions === b.sessions &&
  a.sessionMounts === b.sessionMounts &&
  a.sessionProjectMounts === b.sessionProjectMounts;

type MountPair = {
  readonly a: OwnedMount;
  readonly b: OwnedMount;
};

const isSameMount = ({ a, b }: MountPair): boolean =>
  a.mountId === b.mountId &&
  a.sessionId === b.sessionId &&
  a.workspaceId === b.workspaceId &&
  a.projectId === b.projectId &&
  a.worktreePath === b.worktreePath &&
  a.branch === b.branch &&
  a.isLive === b.isLive;

type MountsPair = {
  readonly a: ReadonlyArray<OwnedMount>;
  readonly b: ReadonlyArray<OwnedMount>;
};

const isSameMounts = ({ a, b }: MountsPair): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((mount, index) => {
    const other = b[index];
    return other !== undefined && isSameMount({ a: mount, b: other });
  });
};

type Params = {
  readonly state: Input;
};

export const selectOwnedMounts = ({ state }: Params): ReadonlyArray<OwnedMount> => {
  if (memo !== null && isSameInput({ a: memo.input, b: state })) {
    return memo.mounts;
  }
  const next = ownedMountsOf({
    sessions: state.sessions,
    sessionMounts: state.sessionMounts,
    sessionProjectMounts: state.sessionProjectMounts,
  });
  const mounts = memo !== null && isSameMounts({ a: memo.mounts, b: next }) ? memo.mounts : next;
  memo = { input: state, mounts };
  return mounts;
};
