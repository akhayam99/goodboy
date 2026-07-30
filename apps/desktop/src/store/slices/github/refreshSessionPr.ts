import { detectRepoSlug, fetchLinkedIssues, listPrsForBranch } from '@goodboy/core';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { formatError } from '../../../shared/lib/errors';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
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
    if (!workspace || isBranchlessSession({ workspaceKind: workspace.kind, branch })) {
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
            sessionGithubPrs: { ...state.sessionGithubPrs, [sessionId]: [] },
            sessionSelectedPrNumber: {
              ...state.sessionSelectedPrNumber,
              [sessionId]: null,
            },
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
        const prs = await listPrsForBranch(tauriGhRunner, slug, branch, {
          cwd: workspace.rootPath,
          workspaceId: session.workspaceId,
        });
        const canonicalPr = prs[0] ?? null;
        const selectedNumber = get().sessionSelectedPrNumber[sessionId] ?? null;
        const selectedPr =
          selectedNumber != null
            ? (prs.find((candidate) => candidate.number === selectedNumber) ?? null)
            : null;
        const displayedPr = selectedPr ?? canonicalPr;
        const linked = displayedPr
          ? await fetchLinkedIssues(tauriGhRunner, slug, displayedPr, {
              cwd: workspace.rootPath,
              workspaceId: session.workspaceId,
            })
          : [];
        set((state) => {
          const existing = state.sessionGithub[sessionId];
          const previousPrs = state.sessionGithubPrs[sessionId] ?? [];
          const previousSelectedNumber = state.sessionSelectedPrNumber[sessionId] ?? null;
          const previousSelectedPr =
            previousSelectedNumber != null
              ? (previousPrs.find((candidate) => candidate.number === previousSelectedNumber) ??
                null)
              : null;
          const previousDisplayedNumber =
            previousSelectedPr?.number ?? existing?.pr?.number ?? null;
          const nextSelectedNumber =
            selectedPr != null && selectedPr.number !== canonicalPr?.number
              ? selectedPr.number
              : null;
          const hasDisplayedPrChanged = previousDisplayedNumber !== displayedPr?.number;
          return {
            sessionGithubPrs: { ...state.sessionGithubPrs, [sessionId]: prs },
            sessionSelectedPrNumber: {
              ...state.sessionSelectedPrNumber,
              [sessionId]: nextSelectedNumber,
            },
            sessionGithub: {
              ...state.sessionGithub,
              [sessionId]: {
                pr: canonicalPr,
                linkedIssues: linked,
                fetchedAt: new Date().toISOString() as IsoDateTime,
                loading: false,
                error: null,
                detail: hasDisplayedPrChanged ? null : (existing?.detail ?? null),
                detailFetchedAt: hasDisplayedPrChanged ? null : (existing?.detailFetchedAt ?? null),
                detailLoading: hasDisplayedPrChanged ? false : (existing?.detailLoading ?? false),
                detailError: hasDisplayedPrChanged ? null : (existing?.detailError ?? null),
              },
            },
          };
        });
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
