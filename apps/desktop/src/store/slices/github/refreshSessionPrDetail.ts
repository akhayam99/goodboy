import { detectRepoSlug, fetchPrDetail } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime, MountId, SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/integrations/github/github';
import { mountRevision, requestIdentityEquals } from '../project-mounts/mountRequests';
import { applyMountGithub } from './mountGithub';
import { githubRequestIdentity } from './mountPrLink';
import { resolveSessionPrFetch } from './resolveSessionPrFetch';
import { syncSourceThreads } from '../review-source/syncSourceThreads';
import type { MountDetailFailure } from './state';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly mountId?: MountId;
  readonly force?: boolean;
  readonly silent?: boolean;
  readonly retries?: number;
};

const DETAIL_TTL_MS = 30_000;

const DETAIL_RETRY_MS = 60_000;

type FailuresParams = {
  readonly failures: Readonly<Record<MountId, MountDetailFailure>> | undefined;
  readonly mountId: MountId;
};

const withoutFailure = ({
  failures,
  mountId,
}: FailuresParams): Readonly<Record<MountId, MountDetailFailure>> => {
  const next = { ...failures };
  delete next[mountId];
  return next;
};

export const refreshSessionPrDetail = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, opts?: Params): Promise<void> => {
    const target = resolveSessionPrFetch({
      state: get(),
      sessionId,
      ...(opts?.mountId === undefined ? {} : { mountId: opts.mountId }),
    });
    if (target === null) {
      return;
    }
    const mount = target.mount;
    const mountId = mount.id;
    const revision = mount.revision;
    const existing = get().mountGithub?.[mountId];
    if (existing === undefined) {
      return;
    }
    const selected = get().mountSelectedPr?.[mountId] ?? null;
    const repository = existing.repository;
    const selectedPr =
      selected === null || repository === null
        ? null
        : (existing.prs.find((candidate) =>
            requestIdentityEquals({
              identity: selected,
              candidate: githubRequestIdentity({ repository, pr: candidate }),
            }),
          ) ?? null);
    const pr = selectedPr ?? existing.pr;
    if (pr === null) {
      return;
    }
    if (opts?.force !== true && existing.detailLoading) {
      return;
    }
    const fresh =
      existing.detailFetchedAt === null
        ? Number.POSITIVE_INFINITY
        : Date.now() - new Date(existing.detailFetchedAt).getTime();
    if (opts?.force !== true && existing.detail !== null && fresh < DETAIL_TTL_MS) {
      return;
    }
    const failure = get().mountDetailFailures?.[mountId];
    if (
      opts?.force !== true &&
      failure !== undefined &&
      failure.revision === revision &&
      Date.now() - failure.failedAt < DETAIL_RETRY_MS
    ) {
      return;
    }
    const isCurrent = (): boolean =>
      mountRevision({ state: get(), sessionId, mountId }) === revision;
    const ghOptions = {
      cwd: target.cwd,
      workspaceId: target.session.workspaceId,
      projectId: mount.projectId,
    };
    set((state) => {
      const current = state.mountGithub?.[mountId];
      if (current === undefined) {
        return state;
      }
      return applyMountGithub({
        state,
        sessionId,
        mountId,
        github: { ...current, detailLoading: true, detailError: null },
      });
    });
    const maxAttempts = (opts?.retries ?? 0) + 1;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const slug =
          repository ??
          (await detectRepoSlug(
            tauriGhRunner,
            target.cwd,
            target.session.workspaceId,
            mount.projectId,
          ));
        if (slug === null || slug === '') {
          if (!isCurrent()) {
            return;
          }
          set((state) => {
            const current = state.mountGithub?.[mountId];
            if (current === undefined) {
              return state;
            }
            return {
              ...applyMountGithub({
                state,
                sessionId,
                mountId,
                github: {
                  ...current,
                  detail: null,
                  detailFetchedAt: new Date().toISOString() as IsoDateTime,
                  detailLoading: false,
                  detailError: null,
                },
              }),
              mountDetailFailures: withoutFailure({ failures: state.mountDetailFailures, mountId }),
            };
          });
          return;
        }
        const detail = await fetchPrDetail(tauriGhRunner, slug, pr.number, ghOptions);
        await syncSourceThreads({
          get,
          sessionId,
          kind: 'github',
          prNumber: pr.number,
          projectId: mount.projectId,
          comments: detail.comments,
        });
        if (!isCurrent()) {
          return;
        }
        set((state) => {
          const current = state.mountGithub?.[mountId];
          if (current === undefined) {
            return state;
          }
          return {
            ...applyMountGithub({
              state,
              sessionId,
              mountId,
              github: {
                ...current,
                detail,
                detailFetchedAt: new Date().toISOString() as IsoDateTime,
                detailLoading: false,
                detailError: null,
              },
            }),
            mountDetailFailures: withoutFailure({ failures: state.mountDetailFailures, mountId }),
          };
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    if (!isCurrent()) {
      return;
    }
    set((state) => {
      const current = state.mountGithub?.[mountId];
      if (current === undefined) {
        return state;
      }
      return {
        ...applyMountGithub({
          state,
          sessionId,
          mountId,
          github: {
            ...current,
            detailLoading: false,
            detailError:
              opts?.silent === true && current.detail !== null ? null : formatError(lastError),
          },
        }),
        mountDetailFailures: {
          ...state.mountDetailFailures,
          [mountId]: { revision, failedAt: Date.now() },
        },
      };
    });
  };
};
