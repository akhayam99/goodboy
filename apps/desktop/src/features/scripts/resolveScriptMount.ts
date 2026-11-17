import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { selectPlaceMount } from '../../store/slices/project-mounts/selectPlaceMount';
import { selectWritableMounts } from '../../store/slices/project-mounts/selectors';

export type ScriptMountOutcome =
  | { readonly kind: 'run'; readonly mount: SessionProjectMount }
  | { readonly kind: 'ask'; readonly mounts: ReadonlyArray<SessionProjectMount> }
  | { readonly kind: 'none' };

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId | null;
  readonly mountId: MountId | null;
};

type LastUsedParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const lastUsedFirst = ({
  state,
  sessionId,
  mounts,
}: LastUsedParams): ReadonlyArray<SessionProjectMount> => {
  const lastRunAt = new Map<MountId, number>();
  for (const record of Object.values(state.scriptRuns[sessionId] ?? {})) {
    if (record.mountId !== undefined) {
      lastRunAt.set(record.mountId, Math.max(lastRunAt.get(record.mountId) ?? 0, record.startedAt));
    }
  }
  return [...mounts].sort(
    (left, right) => (lastRunAt.get(right.mountId) ?? 0) - (lastRunAt.get(left.mountId) ?? 0),
  );
};

export const resolveScriptMount = ({
  state,
  sessionId,
  projectId,
  mountId,
}: Params): ScriptMountOutcome => {
  const candidates = selectWritableMounts({ state, sessionId }).filter(
    (mount) =>
      mount.isAttached &&
      mount.worktreePath !== '' &&
      (projectId === null || mount.projectId === projectId),
  );
  if (mountId !== null) {
    const chosen = candidates.find((mount) => mount.mountId === mountId);
    return chosen === undefined ? { kind: 'none' } : { kind: 'run', mount: chosen };
  }
  const place = selectPlaceMount({ state, sessionId });
  const here =
    place === null ? undefined : candidates.find((mount) => mount.mountId === place.mountId);
  if (here !== undefined) {
    return { kind: 'run', mount: here };
  }
  const [only] = candidates;
  if (only === undefined) {
    return { kind: 'none' };
  }
  if (candidates.length === 1) {
    return { kind: 'run', mount: only };
  }
  return { kind: 'ask', mounts: lastUsedFirst({ state, sessionId, mounts: candidates }) };
};
