import {
  ghStatus,
  ghSetToken,
  ghClearToken,
  tauriGhRunner,
  createTauriPrCacheStore,
} from '../../features/github/github';
import { getPrForBranch, fetchLinkedIssues, fetchPrDetail, detectRepoSlug } from '@goodboy/core';
import type { GhTokenStatus, SessionId, IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';
import { formatError } from '../../shared/lib/errors';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

export function createGithubSlice(set: SetFn, get: GetFn) {
  return {
    refreshGithubStatus: async () => {
      try {
        const status = await ghStatus();
        set({ githubStatus: status });
      } catch (err) {
        set({
          githubStatus: {
            available: false,
            mode: 'absent',
            version: undefined,
            user: undefined,
            scopes: [],
          },
        });
        console.warn('gh_status failed', err);
      }
    },

    setGithubPat: async (token: string): Promise<GhTokenStatus> => {
      const status = await ghSetToken(token);
      set({ githubStatus: status });
      return status;
    },

    clearGithubToken: async () => {
      await ghClearToken();
      await get().refreshGithubStatus();
    },

    refreshSessionPr: async (sessionId: SessionId, opts?: { force?: boolean }) => {
      // In-flight dedup: ContextPanel's effect can refire (StrictMode, fast
      // re-activation) before the first ~1s GitHub round-trip resolves. The
      // existing `loading` flag is the right signal, since this action sets it
      // to true synchronously below.
      if (!opts?.force && get().sessionGithub[sessionId]?.loading) return;
      const branch = get().sessionBranches[sessionId];
      if (!branch) return;
      const session = get().sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
      if (!workspace) return;
      set((state) => ({
        sessionGithub: {
          ...state.sessionGithub,
          [sessionId]: {
            pr: state.sessionGithub[sessionId]?.pr ?? null,
            linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
            fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
            loading: true,
            error: null,
            detail: state.sessionGithub[sessionId]?.detail ?? null,
            detailFetchedAt: state.sessionGithub[sessionId]?.detailFetchedAt ?? null,
            detailLoading: state.sessionGithub[sessionId]?.detailLoading ?? false,
            detailError: state.sessionGithub[sessionId]?.detailError ?? null,
          },
        },
      }));
      try {
        const slug = await detectRepoSlug(tauriGhRunner, workspace.rootPath);
        if (!slug) {
          set((state) => ({
            sessionGithub: {
              ...state.sessionGithub,
              [sessionId]: {
                pr: null,
                linkedIssues: [],
                fetchedAt: new Date().toISOString() as IsoDateTime,
                loading: false,
                error: null,
                detail: null,
                detailFetchedAt: null,
                detailLoading: false,
                detailError: null,
              },
            },
          }));
          return;
        }
        const store = createTauriPrCacheStore(tauriDatabase);
        const pr = await getPrForBranch(
          { runner: tauriGhRunner, store },
          { repoSlug: slug, branch, cwd: workspace.rootPath, force: opts?.force === true },
        );
        const linked = pr
          ? await fetchLinkedIssues(tauriGhRunner, slug, pr, { cwd: workspace.rootPath })
          : [];
        set((state) => ({
          sessionGithub: {
            ...state.sessionGithub,
            [sessionId]: {
              pr,
              linkedIssues: linked,
              fetchedAt: new Date().toISOString() as IsoDateTime,
              loading: false,
              error: null,
              detail: state.sessionGithub[sessionId]?.detail ?? null,
              detailFetchedAt: state.sessionGithub[sessionId]?.detailFetchedAt ?? null,
              detailLoading: state.sessionGithub[sessionId]?.detailLoading ?? false,
              detailError: state.sessionGithub[sessionId]?.detailError ?? null,
            },
          },
        }));
      } catch (err) {
        set((state) => ({
          sessionGithub: {
            ...state.sessionGithub,
            [sessionId]: {
              pr: state.sessionGithub[sessionId]?.pr ?? null,
              linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
              fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
              loading: false,
              error: formatError(err),
              detail: state.sessionGithub[sessionId]?.detail ?? null,
              detailFetchedAt: state.sessionGithub[sessionId]?.detailFetchedAt ?? null,
              detailLoading: state.sessionGithub[sessionId]?.detailLoading ?? false,
              detailError: state.sessionGithub[sessionId]?.detailError ?? null,
            },
          },
        }));
      }
    },

    refreshSessionPrDetail: async (sessionId: SessionId, opts?: { force?: boolean }) => {
      const existing = get().sessionGithub[sessionId];
      const pr = existing?.pr ?? null;
      if (!pr) return;
      // In-flight dedup: the ~3-5s GitHub detail call was firing twice on cold
      // session switches because two effect runs both saw existing.detail still
      // null. Block the second call by checking the loading flag the first one
      // sets synchronously below.
      if (!opts?.force && existing?.detailLoading) return;
      const session = get().sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
      if (!workspace) return;
      const fresh = existing?.detailFetchedAt
        ? Date.now() - new Date(existing.detailFetchedAt).getTime()
        : Number.POSITIVE_INFINITY;
      const DETAIL_TTL_MS = 30_000;
      if (!opts?.force && existing?.detail && fresh < DETAIL_TTL_MS) return;
      set((state) => ({
        sessionGithub: {
          ...state.sessionGithub,
          [sessionId]: {
            pr: state.sessionGithub[sessionId]?.pr ?? pr,
            linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
            fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
            loading: state.sessionGithub[sessionId]?.loading ?? false,
            error: state.sessionGithub[sessionId]?.error ?? null,
            detail: state.sessionGithub[sessionId]?.detail ?? null,
            detailFetchedAt: state.sessionGithub[sessionId]?.detailFetchedAt ?? null,
            detailLoading: true,
            detailError: null,
          },
        },
      }));
      try {
        const slug = await detectRepoSlug(tauriGhRunner, workspace.rootPath);
        if (!slug) {
          set((state) => ({
            sessionGithub: {
              ...state.sessionGithub,
              [sessionId]: {
                pr: state.sessionGithub[sessionId]?.pr ?? pr,
                linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
                fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
                loading: state.sessionGithub[sessionId]?.loading ?? false,
                error: state.sessionGithub[sessionId]?.error ?? null,
                detail: null,
                detailFetchedAt: new Date().toISOString() as IsoDateTime,
                detailLoading: false,
                detailError: null,
              },
            },
          }));
          return;
        }
        const detail = await fetchPrDetail(tauriGhRunner, slug, pr.number, {
          cwd: workspace.rootPath,
        });
        set((state) => ({
          sessionGithub: {
            ...state.sessionGithub,
            [sessionId]: {
              pr: state.sessionGithub[sessionId]?.pr ?? pr,
              linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
              fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
              loading: state.sessionGithub[sessionId]?.loading ?? false,
              error: state.sessionGithub[sessionId]?.error ?? null,
              detail,
              detailFetchedAt: new Date().toISOString() as IsoDateTime,
              detailLoading: false,
              detailError: null,
            },
          },
        }));
      } catch (err) {
        set((state) => ({
          sessionGithub: {
            ...state.sessionGithub,
            [sessionId]: {
              pr: state.sessionGithub[sessionId]?.pr ?? pr,
              linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
              fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
              loading: state.sessionGithub[sessionId]?.loading ?? false,
              error: state.sessionGithub[sessionId]?.error ?? null,
              detail: state.sessionGithub[sessionId]?.detail ?? null,
              detailFetchedAt: state.sessionGithub[sessionId]?.detailFetchedAt ?? null,
              detailLoading: false,
              detailError: formatError(err),
            },
          },
        }));
      }
    },

    createPrForSession: async (sessionId: SessionId) => {
      const branch = get().sessionBranches[sessionId];
      const session = get().sessions.find((s) => s.id === sessionId);
      if (!branch || !session) return;
      const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
      if (!workspace) return;
      const res = await tauriGhRunner.run(['pr', 'create', '--fill', '--draft'], {
        cwd: workspace.rootPath,
      });
      if (res.exitCode !== 0) {
        const errMsg = res.stderr.trim() || `gh pr create exited with ${res.exitCode}`;
        void get().emitNotification('error', 'error', 'PR creation failed', errMsg, {
          sessionId,
          workspaceId: workspace.id,
        });
        throw new Error(errMsg);
      }
      await get().refreshSessionPr(sessionId, { force: true });
      void get().emitNotification(
        'pr-created',
        'success',
        `PR created for: ${session.goal}`,
        undefined,
        { sessionId, workspaceId: workspace.id },
      );
    },
  };
}
