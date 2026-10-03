import {
  listSessionContextItems,
  listWorkspaceLearnings,
  setSessionContextItemStatus,
} from '@goodboy/db';
import type {
  IsoDateTime,
  SessionContextItem,
  SessionContextItemId,
  SessionContextItemStatus,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SliceDeps } from '../../slice-types';
import type { ContextItemsState } from './state';

type LoadSessionParams = {
  readonly sessionId: SessionId;
  readonly force?: boolean;
};

type LoadWorkspaceParams = {
  readonly workspaceId: WorkspaceId;
  readonly force?: boolean;
};

type StatusParams = {
  readonly id: SessionContextItemId;
  readonly status: SessionContextItemStatus;
};

type RefreshParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

type PatchParams = StatusParams & {
  readonly updatedAt: IsoDateTime;
};

const patchItems = <K extends string>({
  byKey,
  id,
  status,
  updatedAt,
}: PatchParams & {
  readonly byKey: Readonly<Record<K, ReadonlyArray<SessionContextItem>>>;
}): Readonly<Record<K, ReadonlyArray<SessionContextItem>>> =>
  Object.fromEntries(
    Object.entries<ReadonlyArray<SessionContextItem>>(byKey).map(([key, items]) => [
      key,
      items.some((item) => item.id === id)
        ? items.map((item) => (item.id === id ? { ...item, status, updatedAt } : item))
        : items,
    ]),
  ) as Readonly<Record<K, ReadonlyArray<SessionContextItem>>>;

export const patchContextItemsState = ({
  state,
  ...patch
}: PatchParams & { readonly state: ContextItemsState }): ContextItemsState => ({
  sessionContextItems: patchItems({ byKey: state.sessionContextItems, ...patch }),
  workspaceLearnings: patchItems({ byKey: state.workspaceLearnings, ...patch }),
});

const findItem = ({
  state,
  id,
}: {
  readonly state: ContextItemsState;
  readonly id: SessionContextItemId;
}): SessionContextItem | undefined =>
  [...Object.values(state.sessionContextItems), ...Object.values(state.workspaceLearnings)]
    .flat()
    .find((item) => item.id === id);

export const createContextItemsSlice = ({ set, get }: SliceDeps) => ({
  loadSessionContextItems: async ({ sessionId, force = false }: LoadSessionParams) => {
    if (!force && get().sessionContextItems[sessionId] !== undefined) {
      return;
    }
    const items = await listSessionContextItems({ db: tauriDatabase, sessionId });
    set((state) => ({
      sessionContextItems: { ...state.sessionContextItems, [sessionId]: items },
    }));
  },

  loadWorkspaceLearnings: async ({ workspaceId, force = false }: LoadWorkspaceParams) => {
    if (!force && get().workspaceLearnings[workspaceId] !== undefined) {
      return;
    }
    const items = await listWorkspaceLearnings({ db: tauriDatabase, workspaceId });
    set((state) => ({
      workspaceLearnings: { ...state.workspaceLearnings, [workspaceId]: items },
    }));
  },

  refreshContextItems: async ({ sessionId, workspaceId }: RefreshParams) => {
    const hasWorkspace = get().workspaceLearnings[workspaceId] !== undefined;
    const [sessionItems, workspaceItems] = await Promise.all([
      listSessionContextItems({ db: tauriDatabase, sessionId }),
      hasWorkspace ? listWorkspaceLearnings({ db: tauriDatabase, workspaceId }) : null,
    ]);
    set((state) => ({
      sessionContextItems: { ...state.sessionContextItems, [sessionId]: sessionItems },
      ...(workspaceItems !== null && {
        workspaceLearnings: { ...state.workspaceLearnings, [workspaceId]: workspaceItems },
      }),
    }));
  },

  setContextItemStatus: async ({ id, status }: StatusParams) => {
    const previous = findItem({ state: get(), id });
    if (previous === undefined || previous.status === status) {
      return;
    }
    const updatedAt = new Date().toISOString() as IsoDateTime;
    set((state) => patchContextItemsState({ state, id, status, updatedAt }));
    try {
      await setSessionContextItemStatus({ db: tauriDatabase, id, status, updatedAt });
    } catch (error) {
      set((state) =>
        patchContextItemsState({
          state,
          id,
          status: previous.status,
          updatedAt: previous.updatedAt,
        }),
      );
      throw error;
    }
  },
});
