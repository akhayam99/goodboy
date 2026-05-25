import {
  ghStatus,
  ghSetToken,
  ghClearToken,
  tauriGhRunner,
  createTauriPrCacheStore,
} from '../../features/github/github';
import {
  addReviewThreadReply,
  detectRepoSlug,
  fetchLinkedIssues,
  fetchPrDetail,
  getPrForBranch,
  resolveReviewThread,
} from '@goodboy/core';
import type { GhTokenStatus, SessionId, IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';
import { formatError } from '../../shared/lib/errors';
import { archivedMapFromSessions } from '../../shared/lib/archived-sessions';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

/**
 * Build the markdown body the agent leaves on the review thread when the
 * user clicks "close on github". Two shapes:
 *   - commit-backed closure → `Resolved in [\`abc1234\`](commit url)`. We
 *     derive the commit url from the PR url so the link points at the
 *     same repo/branch the user is reviewing.
 *   - free-text closure (e.g. "not applicable") → posts the reason as-is
 *     prefixed with "Closing:".
 * Returns null when there is no closure context so the caller falls back
 * to a silent resolve.
 */
function buildResolutionReplyBody(
  closure: { commitSha?: string; reason?: string } | undefined,
  prUrl: string | null,
): string | null {
  if (!closure) return null;
  const sha = closure.commitSha?.trim();
  if (sha && sha.length > 0) {
    const short = sha.slice(0, 7);
    const commitUrl = prUrl ? prUrl.replace(/\/pull\/\d+(?:\/.*)?$/, `/commit/${sha}`) : null;
    if (commitUrl && commitUrl !== prUrl) {
      return `Resolved in [\`${short}\`](${commitUrl}).`;
    }
    return `Resolved in \`${short}\`.`;
  }
  const reason = closure.reason?.trim();
  if (reason && reason.length > 0) {
    return `Closing: ${reason}`;
  }
  return null;
}

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

    refreshSessionPr: async (
      sessionId: SessionId,
      opts?: { force?: boolean; silent?: boolean; retries?: number },
    ) => {
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
      // Retry loop. Polling sweeps pass `retries: 1` so a transient gh
      // failure gets a second chance; everything else defaults to a single
      // attempt. The `slug === null` branch is a real success (no git repo
      // for this workspace) and short-circuits without retrying.
      const maxAttempts = (opts?.retries ?? 0) + 1;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
          return;
        } catch (err) {
          lastErr = err;
        }
      }
      // All attempts failed. `silent: true` (polling) suppresses the error
      // chip — by design the timer-driven path shouldn't paint failures the
      // user didn't ask for. Explicit refreshes keep the existing UI.
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
    },

    refreshSessionPrDetail: async (
      sessionId: SessionId,
      opts?: { force?: boolean; silent?: boolean; retries?: number },
    ) => {
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
      // Retry loop — same shape as `refreshSessionPr`. Polling sweeps pass
      // `retries: 1` so a transient gh failure gets a second chance.
      const maxAttempts = (opts?.retries ?? 0) + 1;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
          return;
        } catch (err) {
          lastErr = err;
        }
      }
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
            detailError: opts?.silent ? null : formatError(lastErr),
          },
        },
      }));
    },

    // Closes a review thread on github with a contextual reply, then flips the
    // thread to resolved. The reply is built from the optional `closure`
    // payload — a commit sha turns into `Resolved in [<short>](commit url)`,
    // a free-text reason posts that verbatim. Without a closure the thread is
    // resolved silently (back-compat for any caller that still hits the bare
    // form). Returns true on success so the chip can collapse its CTA.
    resolveGithubThread: async (
      sessionId: SessionId,
      threadId: string,
      closure?: { commitSha?: string; reason?: string },
    ): Promise<boolean> => {
      const session = get().sessions.find((s) => s.id === sessionId);
      if (!session) return false;
      const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
      const pr = get().sessionGithub[sessionId]?.pr ?? null;
      const replyBody = buildResolutionReplyBody(closure, pr?.url ?? null);
      try {
        if (replyBody) {
          await addReviewThreadReply(tauriGhRunner, threadId, replyBody, {
            cwd: workspace?.rootPath,
          });
        }
        await resolveReviewThread(tauriGhRunner, threadId, { cwd: workspace?.rootPath });
        await get().refreshSessionPrDetail(sessionId, { force: true });
        return true;
      } catch (err) {
        void get().emitNotification('error', 'error', 'resolve thread failed', formatError(err), {
          sessionId,
          ...(workspace && { workspaceId: workspace.id }),
        });
        return false;
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

    // Interim PR auto-refresh until a GitHub webhook lands. Sweeps every
    // session held in `state.sessions` (the active workspace's): head for all,
    // detail for the one whose card is open. Each refresh is silent with one
    // retry — polling errors don't deserve UI, transient gh failures get a
    // second chance. No `force` — the 60s/30s caches absorb overlapping
    // sweep / on-access / manual refreshes.
    //
    // Filters:
    //   - archived sessions → hidden in the sidebar, polling them is waste.
    //   - terminal PRs (merged/closed) → no new commits, CI, or reviews can
    //     land. On-access still refreshes them so reopening shows current.
    //   - `skipUnknownPr` → set by the steady-state interval. Sessions where
    //     we already learned there's no PR (`pr === null` post-fetch) get
    //     skipped, since the in-app PR-creation paths (`createPrForSession`
    //     + the assistant-text URL detector + the summarizer hook) refresh
    //     them explicitly. The reactive sweep (boot / workspace switch /
    //     new session) still polls them once so PRs created from outside
    //     the app are discovered.
    sweepGithub: (opts?: { skipUnknownPr?: boolean }) => {
      if (!get().githubStatus?.available) return;
      const { sessions, sessionBranches, sessionGithub, currentSessionId } = get();
      const archived = archivedMapFromSessions(sessions);
      const subOpts = { silent: true, retries: 1 } as const;
      for (const session of sessions) {
        if (archived[session.id]) continue;
        if (!sessionBranches[session.id]) continue;
        const cached = sessionGithub[session.id];
        const pr = cached?.pr;
        if (pr && (pr.state === 'merged' || pr.state === 'closed')) continue;
        if (opts?.skipUnknownPr && cached?.fetchedAt && pr === null) continue;
        const head = get().refreshSessionPr(session.id, subOpts);
        if (session.id === currentSessionId) {
          void head.then(() => get().refreshSessionPrDetail(session.id, subOpts));
        }
      }
    },
  };
}
