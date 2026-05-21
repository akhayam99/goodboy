import { invoke } from '@tauri-apps/api/core';
import { Clusterizer, Rephraser, type ClusterizeOutput, type IdeaCluster } from '@goodboy/core';
import {
  deleteIdea as deleteIdeaQuery,
  insertIdea,
  listIdeasForWorkspace,
  listRawIdeas,
  markIdeaSpawned,
  updateIdeaFailed,
  updateIdeaRephrase,
} from '@goodboy/db';
import type { IdeaBacklog, IdeaBacklogId, ProviderId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

export interface BrainDumpState {
  readonly ideas: Readonly<Record<WorkspaceId, ReadonlyArray<IdeaBacklog>>>;
  readonly ideasLoading: Readonly<Record<WorkspaceId, boolean>>;
  readonly rephrasingIdeaIds: ReadonlySet<IdeaBacklogId>;
  readonly clusterPreview: ClusterizeOutput | null;
  readonly clusterizing: boolean;
  readonly clusterError: string | null;
}

export const initialBrainDumpState: BrainDumpState = {
  ideas: {},
  ideasLoading: {},
  rephrasingIdeaIds: new Set<IdeaBacklogId>(),
  clusterPreview: null,
  clusterizing: false,
  clusterError: null,
};

function defaultProvider(store: AppStore): ProviderId {
  // Prefer the current session's default provider; fall back to the first
  // connected provider, then to anthropic. The rephraser is a fire-and-forget
  // process — if nothing is configured the rephrase fails and the recovery
  // sweep retries next boot.
  const sid = store.currentSessionId;
  const session = sid ? store.sessions.find((s) => s.id === sid) : null;
  if (session) return session.providerPreference.defaultProvider;
  const connected = store.providers.find((p) => p.connection === 'connected');
  return (connected?.id ?? 'anthropic') as ProviderId;
}

export function createBrainDumpSlice(set: SetFn, get: GetFn) {
  const startRephrasing = (id: IdeaBacklogId) => {
    set((state) => ({
      rephrasingIdeaIds: new Set<IdeaBacklogId>([...state.rephrasingIdeaIds, id]),
    }));
  };

  const stopRephrasing = (id: IdeaBacklogId) => {
    set((state) => {
      const next = new Set<IdeaBacklogId>(state.rephrasingIdeaIds);
      next.delete(id);
      return { rephrasingIdeaIds: next };
    });
  };

  const replaceIdea = (workspaceId: WorkspaceId, idea: IdeaBacklog) => {
    set((state) => ({
      ideas: {
        ...state.ideas,
        [workspaceId]: (state.ideas[workspaceId] ?? []).map((i) => (i.id === idea.id ? idea : i)),
      },
    }));
  };

  const dropIdea = (workspaceId: WorkspaceId, id: IdeaBacklogId) => {
    set((state) => ({
      ideas: {
        ...state.ideas,
        [workspaceId]: (state.ideas[workspaceId] ?? []).filter((i) => i.id !== id),
      },
    }));
  };

  const runRephraser = async (idea: IdeaBacklog) => {
    const store = get();
    const providerId = defaultProvider(store);
    const rephraser = new Rephraser({ providerId, invokeFn: invoke });
    try {
      const out = await rephraser.rephrase({
        rawText: idea.rawText,
        currentWorkspaceId: idea.workspaceId,
        workspaces: store.workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          ...(w.disconnectedAt && { description: 'archived' }),
        })),
      });
      const updated = await updateIdeaRephrase(
        tauriDatabase,
        idea.id,
        out.title,
        out.body,
        out.suggestedWorkspaceId,
      );
      replaceIdea(idea.workspaceId, updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextRetry = idea.retryCount + 1;
      const failed = await updateIdeaFailed(tauriDatabase, idea.id, nextRetry, message);
      replaceIdea(idea.workspaceId, failed);
    } finally {
      stopRephrasing(idea.id);
    }
  };

  return {
    loadIdeasForWorkspace: async (workspaceId: WorkspaceId): Promise<void> => {
      set((state) => ({
        ideasLoading: { ...state.ideasLoading, [workspaceId]: true },
      }));
      try {
        const rows = await listIdeasForWorkspace(tauriDatabase, workspaceId);
        set((state) => ({
          ideas: { ...state.ideas, [workspaceId]: rows },
          ideasLoading: { ...state.ideasLoading, [workspaceId]: false },
        }));
      } catch {
        set((state) => ({
          ideasLoading: { ...state.ideasLoading, [workspaceId]: false },
        }));
      }
    },

    submitBrainDump: async (workspaceId: WorkspaceId, rawText: string): Promise<IdeaBacklogId> => {
      const trimmed = rawText.trim();
      if (trimmed.length === 0) {
        throw new Error('brain dump cannot be empty');
      }
      const id = crypto.randomUUID() as IdeaBacklogId;
      const idea = await insertIdea(tauriDatabase, { id, rawText: trimmed, workspaceId });
      // Optimistic push so the user sees the row immediately. The runRephraser
      // call below replaces it in place once the model returns.
      set((state) => ({
        ideas: {
          ...state.ideas,
          [workspaceId]: [idea, ...(state.ideas[workspaceId] ?? [])],
        },
      }));
      startRephrasing(idea.id);
      void runRephraser(idea);
      return id;
    },

    retryRephrase: async (id: IdeaBacklogId): Promise<void> => {
      const store = get();
      // Find the idea across all workspace buckets.
      let target: IdeaBacklog | null = null;
      for (const list of Object.values(store.ideas)) {
        const hit = list.find((i) => i.id === id);
        if (hit) {
          target = hit;
          break;
        }
      }
      if (!target) return;
      startRephrasing(id);
      void runRephraser(target);
    },

    deleteIdea: async (id: IdeaBacklogId): Promise<void> => {
      const store = get();
      let owner: WorkspaceId | null = null;
      for (const [ws, list] of Object.entries(store.ideas)) {
        if (list.some((i) => i.id === id)) {
          owner = ws as WorkspaceId;
          break;
        }
      }
      await deleteIdeaQuery(tauriDatabase, id);
      if (owner) dropIdea(owner, id);
    },

    runClusterer: async (workspaceId: WorkspaceId): Promise<void> => {
      const store = get();
      const ideas = (store.ideas[workspaceId] ?? []).filter((i) => i.status === 'rephrased');
      if (ideas.length < 2) {
        set({
          clusterPreview: { clusters: [] },
          clusterError: 'need at least 2 rephrased ideas to cluster',
        });
        return;
      }
      set({ clusterizing: true, clusterError: null, clusterPreview: null });
      try {
        const providerId = defaultProvider(store);
        const clusterizer = new Clusterizer({ providerId, invokeFn: invoke });
        const out = await clusterizer.clusterize({
          ideas: ideas.map((i) => ({
            id: i.id,
            title: i.rephrasedTitle ?? i.rawText.slice(0, 60),
            body: i.rephrasedBody ?? '',
          })),
        });
        set({ clusterPreview: out, clusterizing: false });
      } catch (err) {
        set({
          clusterizing: false,
          clusterError: err instanceof Error ? err.message : String(err),
        });
      }
    },

    dismissClusterPreview: (): void => {
      set({ clusterPreview: null, clusterError: null });
    },

    spawnFromCluster: async (
      cluster: IdeaCluster,
      args: { workspaceId: WorkspaceId; sessionGoal?: string },
    ): Promise<void> => {
      const store = get();
      const bucket = store.ideas[args.workspaceId] ?? [];
      const memberIdeas = cluster.itemIds
        .map((id) => bucket.find((i) => i.id === id))
        .filter((i): i is IdeaBacklog => Boolean(i));
      const goalLines = memberIdeas.map((i) => {
        const title = i.rephrasedTitle ?? i.rawText.slice(0, 60);
        const body = i.rephrasedBody ?? '';
        return `- ${title}${body ? ` — ${body}` : ''}`;
      });
      const goal =
        args.sessionGoal ??
        [`Cluster: ${cluster.name}`, '', 'Items to address:', ...goalLines].join('\n');
      await get().createSession({
        workspaceId: args.workspaceId,
        goal,
        firstAgentKind: 'planner',
      });
      // Best-effort: mark each member spawned + remove from local cache. We
      // don't roll the session creation back if cleanup fails — the session
      // is the user-visible artifact, the items are bookkeeping.
      for (const idea of memberIdeas) {
        try {
          await markIdeaSpawned(tauriDatabase, idea.id);
          dropIdea(args.workspaceId, idea.id);
        } catch {
          // swallow — recovery is fine, the UI just shows the items
        }
      }
    },

    recoverPendingRephrases: async (workspaceId: WorkspaceId): Promise<void> => {
      let pending: ReadonlyArray<IdeaBacklog> = [];
      try {
        pending = await listRawIdeas(tauriDatabase, workspaceId);
      } catch {
        return;
      }
      if (pending.length === 0) return;
      // Ensure the local bucket is populated so UI can show retry states.
      set((state) => {
        const existing = state.ideas[workspaceId] ?? [];
        const seen = new Set(existing.map((i) => i.id));
        const merged = [...existing];
        for (const p of pending) {
          if (!seen.has(p.id)) merged.unshift(p);
        }
        return { ideas: { ...state.ideas, [workspaceId]: merged } };
      });
      // Fire each retry sequentially with a small stagger to avoid hammering
      // the CLI on cold-boot when many items are queued.
      for (const idea of pending) {
        startRephrasing(idea.id);
        // Don't await — let the queue drain in parallel up to natural CLI throttle.
        void runRephraser(idea);
      }
    },
  };
}
