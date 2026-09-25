import {
  listResolvePublicationThreads,
  listResolvePublicationsForSession,
  listResolveThreads,
  setResolvePublicationPhase,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type {
  PrComment,
  ResolvePublicationDrift,
  ResolvePublicationPreview,
  ResolvePublicationThread,
  ResolveThread,
} from '@goodboy/types';
import { acquireWorktreeWriter, releaseWorktreeWriter } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { approvedPublicationScope } from './approvedPublicationScope';
import { liveMountTarget } from './mountTarget';
import { deliverPublicationThread } from './deliverPublicationThread';
import { isDeliveryComplete } from './deliveryReceipts';
import { preparePublication } from './preparePublication';
import { publicationOutcome, type PublicationOutcome } from './publicationOutcome';
import { RESOLVE_ON_GITHUB_DEFAULT, resolveStepPlan } from './resolveStepPlan';
import { isDriftChecked, mountTargetDrift, publicationDrift } from './publicationDrift';
import { loadPublicationsInto } from './publicationState';
import { startPublicationHeartbeat } from './publicationHeartbeat';
import { withPublicationLock } from './publicationLock';
import { PUBLICATION_INTERRUPTED } from './reconcileInterruptedPublications';
import { restoreResolvePublication } from './restoreResolvePublication';
import { verifiedPush } from './verifiedPush';
import type { PublishParams, SliceParams } from './types';

type Params = SliceParams & PublishParams;

export type PublishConversationsResult =
  | { readonly kind: 'missing' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'stale'; readonly preview: ResolvePublicationPreview }
  | { readonly kind: 'push_failed'; readonly error: string }
  | ({ readonly kind: 'done' } & PublicationOutcome);

type LockedResult =
  | PublishConversationsResult
  | { readonly kind: 'drifted'; readonly drift: ReadonlyArray<ResolvePublicationDrift> };

type QuietlyParams = {
  readonly publicationId: string;
  readonly work: () => Promise<unknown>;
};

const quietly = async ({ publicationId, work }: QuietlyParams): Promise<void> => {
  try {
    await work();
  } catch (error) {
    console.warn(`[resolve-publication] ${publicationId}: ${formatError(error)}`);
  }
};

type RestoreAllParams = {
  readonly get: SliceParams['get'];
  readonly sessionId: PublishParams['sessionId'];
  readonly frozen: ReadonlyArray<ResolvePublicationThread>;
  readonly rowsBefore: ReadonlyArray<ResolveThread>;
  readonly error: string;
};

const restoreAll = async ({
  get,
  sessionId,
  frozen,
  rowsBefore,
  error,
}: RestoreAllParams): Promise<void> => {
  for (const thread of frozen) {
    await restoreResolvePublication({
      get,
      sessionId,
      threadId: thread.threadId,
      previous: rowsBefore.find((item) => item.threadId === thread.threadId),
      hasCommit: thread.resolvePhase !== 'skipped',
      error,
    });
  }
};

const inFlight = new Map<string, Promise<PublishConversationsResult>>();

const publishOnce = async ({
  set,
  get,
  sessionId,
  publicationId,
  scopeId,
}: Params): Promise<PublishConversationsResult> => {
  const publications = await listResolvePublicationsForSession({ db: tauriDatabase, sessionId });
  const publication = publications.find((candidate) => candidate.id === publicationId);
  if (publication === undefined || publication.phase === 'cancelled') {
    return { kind: 'missing' };
  }
  if (publication.requiresPush && publication.mountTarget === null) {
    return { kind: 'missing' };
  }
  const worktreePath = publication.mountTarget?.worktreePath ?? '';
  const frozen = await listResolvePublicationThreads({ db: tauriDatabase, publicationId });
  if (publication.phase === 'finished') {
    return {
      kind: 'done',
      ...publicationOutcome({ receipts: frozen, pushedHead: publication.pushedHead }),
    };
  }
  const locked = await withPublicationLock<LockedResult>({
    repo: publication.repo,
    prNumber: publication.prNumber,
    ...(scopeId !== undefined && { scopeId }),
    exceptPublicationId: publicationId,
    onBusy: () => ({ kind: 'busy' }),
    run: async () => {
      const holder = `publish:${publicationId}`;
      const lease = publication.requiresPush
        ? await acquireWorktreeWriter({ path: worktreePath, holder })
        : null;
      if (lease !== null && !lease.isGranted) {
        return { kind: 'busy' };
      }
      let stopHeartbeat = (): void => undefined;
      try {
        const current = (
          await listResolvePublicationsForSession({ db: tauriDatabase, sessionId })
        ).find((candidate) => candidate.id === publicationId);
        if (current === undefined || current.error === PUBLICATION_INTERRUPTED) {
          return { kind: 'missing' };
        }
        const rowsBefore = await listResolveThreads({ db: tauriDatabase, sessionId });
        const comments: ReadonlyArray<PrComment> =
          get().sessionGithub[sessionId]?.detail?.comments ?? [];
        const liveTarget = liveMountTarget({ get, sessionId, target: publication.mountTarget });
        const targetDrift = mountTargetDrift({
          frozenTarget: publication.mountTarget,
          liveTarget,
        });
        const isDrifted = targetDrift !== null || isDriftChecked({ publication });
        if (isDrifted) {
          const scope = await approvedPublicationScope({ sessionId });
          const drift =
            targetDrift === null
              ? await publicationDrift({
                  publication,
                  frozen,
                  rows: rowsBefore,
                  comments,
                  scope,
                  worktreePath,
                  liveTarget,
                })
              : [targetDrift];
          if (drift.length > 0) {
            await setResolvePublicationPhase({
              db: tauriDatabase,
              id: publicationId,
              phase: 'cancelled',
              error: 'stale',
            });
            return { kind: 'drifted', drift };
          }
        }
        stopHeartbeat = await startPublicationHeartbeat({ publicationId });
        await setResolvePublicationPhase({
          db: tauriDatabase,
          id: publicationId,
          phase: 'confirmed',
        });
        const receipts = new Map(frozen.map((thread) => [thread.threadId, thread]));
        let pushedHead = publication.pushedHead;
        try {
          for (const thread of frozen) {
            const row = rowsBefore.find((item) => item.threadId === thread.threadId);
            const isSettled = thread.error === null && isDeliveryComplete({ receipt: thread });
            if (row?.state === 'closed' || isSettled) {
              continue;
            }
            await get().updateResolveThread({
              sessionId,
              threadId: thread.threadId,
              prNumber: publication.prNumber,
              patch: { state: 'publishing' },
            });
          }
          if (publication.requiresPush && pushedHead === null) {
            await setResolvePublicationPhase({
              db: tauriDatabase,
              id: publicationId,
              phase: 'pushing',
            });
            const error = await verifiedPush({ get, sessionId, publication });
            if (error !== null) {
              await setResolvePublicationPhase({
                db: tauriDatabase,
                id: publicationId,
                phase: 'failed',
                error,
              });
              await restoreAll({ get, sessionId, frozen, rowsBefore, error });
              await loadPublicationsInto({ set, sessionId });
              void get().emitNotification({
                kind: 'error',
                severity: 'error',
                title: 'Nothing was pushed',
                body: `${error}. The conversations stayed as they were.`,
                sessionId,
                action: { kind: 'retry-publication', sessionId },
              });
              return { kind: 'push_failed', error };
            }
            pushedHead = publication.localHead;
            await setResolvePublicationPhase({
              db: tauriDatabase,
              id: publicationId,
              phase: 'pushed',
              pushedHead,
            });
          }
          await setResolvePublicationPhase({
            db: tauriDatabase,
            id: publicationId,
            phase: 'posting',
          });
          for (const thread of frozen) {
            const receipt = await deliverPublicationThread({
              get,
              sessionId,
              publicationId,
              thread,
              previous: rowsBefore.find((item) => item.threadId === thread.threadId),
              plan: resolveStepPlan({
                threadId: thread.threadId,
                comments,
                shouldResolveOnGithub: RESOLVE_ON_GITHUB_DEFAULT,
              }),
            });
            receipts.set(thread.threadId, receipt);
          }
        } catch (error) {
          await quietly({
            publicationId,
            work: () =>
              restoreAll({ get, sessionId, frozen, rowsBefore, error: formatError(error) }),
          });
          throw error;
        }
        const stored = await listResolvePublicationThreads({
          db: tauriDatabase,
          publicationId,
        }).catch(() => null);
        const outcome = publicationOutcome({
          receipts: stored ?? [...receipts.values()],
          pushedHead,
        });
        await quietly({
          publicationId,
          work: () =>
            setResolvePublicationPhase({
              db: tauriDatabase,
              id: publicationId,
              phase: outcome.failed === 0 ? 'finished' : 'failed',
              error: outcome.error,
            }),
        });
        await quietly({ publicationId, work: () => loadPublicationsInto({ set, sessionId }) });
        set((state) => ({
          activePublicationPreview: { ...state.activePublicationPreview, [sessionId]: null },
        }));
        await quietly({
          publicationId,
          work: () => get().refreshSessionPrDetail(sessionId, { force: true }),
        });
        return { kind: 'done', ...outcome };
      } finally {
        stopHeartbeat();
        if (lease !== null) {
          await releaseWorktreeWriter({ path: worktreePath, holder }).catch(() => undefined);
        }
      }
    },
  });
  if (locked.kind !== 'drifted') {
    return locked;
  }
  const preview = await preparePublication({
    set,
    get,
    sessionId,
    threadIds: frozen.map((thread) => thread.threadId),
    drift: locked.drift,
    ...(scopeId !== undefined && { scopeId }),
  });
  await loadPublicationsInto({ set, sessionId });
  return { kind: 'stale', preview };
};

export const publishConversations = (params: Params): Promise<PublishConversationsResult> => {
  const running = inFlight.get(params.publicationId);
  if (running !== undefined) {
    return running;
  }
  const work = publishOnce(params).finally(() => {
    inFlight.delete(params.publicationId);
  });
  inFlight.set(params.publicationId, work);
  return work;
};
