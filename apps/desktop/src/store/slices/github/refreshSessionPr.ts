import { detectRepoSlug, fetchLinkedIssues, getPrForBranch } from '@goodboy/core';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { createTauriPrCacheStore, tauriGhRunner } from '../../../features/github/github';
import { tauriDatabase } from '../../../shared/lib/db';
import { formatError } from '../../../shared/lib/errors';
import type { GetFn, SetFn } from './types';

type Params = {
  force?: boolean;
  silent?: boolean;
  retries?: number;
};

export const refreshSessionPr = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, opts?: Params) => {
    if (!opts?.force && get().sessionGithub[sessionId]?.loading) {
      return;
    }
    const branch = get().sessionBranches[sessionId];
    if (!branch) {
      return;
    }
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      return;
    }
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace || workspace.kind === 'simple') {
      return;
    }
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
    const maxAttempts = (opts?.retries ?? 0) + 1;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const slug = await detectRepoSlug(tauriGhRunner, workspace.rootPath, session.workspaceId);
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
          {
            repoSlug: slug,
            branch,
            cwd: workspace.rootPath,
            workspaceId: session.workspaceId,
            force: opts?.force === true,
          },
        );
        const linked = pr
          ? await fetchLinkedIssues(tauriGhRunner, slug, pr, {
              cwd: workspace.rootPath,
              workspaceId: session.workspaceId,
            })
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
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    set((state) => ({
      sessionGithub: {
        ...state.sessionGithub,
        [sessionId]: {
          pr: state.sessionGithub[sessionId]?.pr ?? null,
          linkedIssues: state.sessionGithub[sessionId]?.linkedIssues ?? [],
          fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
          loading: false,
          error: opts?.silent ? null : formatError(lastErr),
          detail: state.sessionGithub[sessionId]?.detail ?? null,
          detailFetchedAt: state.sessionGithub[sessionId]?.detailFetchedAt ?? null,
          detailLoading: state.sessionGithub[sessionId]?.detailLoading ?? false,
          detailError: state.sessionGithub[sessionId]?.detailError ?? null,
        },
      },
    }));
  };
};
