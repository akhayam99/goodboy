import {
  listResolveAttempts,
  listResolveCandidateItems,
  listResolveCandidates,
  listResolveQueueItems,
  setResolveCandidateState,
} from '@goodboy/db';
import type {
  ResolveCandidate,
  ResolveLaunchChoice,
  ResolveQueueItemWithThread,
} from '@goodboy/types';
import { draftRoutingOf } from '../../../features/resolve/draftRouting';
import { LANE_REBUILD_HINT } from '../../../features/resolve/laneCopy';
import { launchChoiceOf } from '../../../features/resolve/launchChoice';
import { startBatch } from '../../../features/resolve/startBatch';
import { tauriDatabase } from '../../../shared/lib/db';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { laneChainOf } from './resolveLane';
import { takeUpResolveQueueItem } from './takeUpResolveQueueItem';
import type { SessionParams, SliceParams } from './types';

type Params = SliceParams & SessionParams;

const REBUILDABLE = new Set(['none', 'deferred']);

const rebuildChoiceOf = ({
  choice,
  broken,
}: {
  readonly choice: ResolveLaunchChoice;
  readonly broken: ReadonlyArray<ResolveCandidate>;
}): ResolveLaunchChoice => {
  const earlier = broken.map((candidate) => candidate.candidateSha.slice(0, 9)).join(', ');
  const parts = [choice.hint, LANE_REBUILD_HINT, `Earlier attempts: ${earlier}.`];
  return {
    ...choice,
    hint: parts.filter((part): part is string => part !== null && part !== '').join('\n\n'),
  };
};

const reconcileLanePath = async ({
  set,
  get,
  sessionId,
  worktreePath,
}: Params & { readonly worktreePath: string }): Promise<boolean> => {
  const db = tauriDatabase;
  const candidates = await listResolveCandidates({ db, sessionId });
  const { broken } = laneChainOf({
    candidates: candidates.map((candidate) => ({ candidate })),
    worktreePath,
  });
  if (broken.length === 0) {
    return false;
  }
  const entries = await listResolveQueueItems({ db, sessionId });
  const rebuild = new Map<string, ResolveQueueItemWithThread>();
  for (const { candidate } of broken) {
    const members = await listResolveCandidateItems({ db, candidateId: candidate.id });
    for (const member of members) {
      const entry = entries.find(({ item }) => item.id === member.queueItemId);
      if (
        entry !== undefined &&
        REBUILDABLE.has(entry.item.approvalState) &&
        entry.thread.state !== 'closed'
      ) {
        rebuild.set(entry.thread.threadId, entry);
      }
    }
  }
  if (rebuild.size > 0) {
    const attempts = await listResolveAttempts({ db, sessionId });
    const first = broken[0];
    const known = attempts.find((attempt) => attempt.id === first?.candidate.id)?.launchChoice;
    const choice =
      known ??
      launchChoiceOf({
        routing: draftRoutingOf({ state: get(), sessionId }),
        commitStyle: null,
        hint: null,
      });
    try {
      for (const { item } of rebuild.values()) {
        if (item.approvalState === 'deferred') {
          await takeUpResolveQueueItem({ set, get, sessionId, itemId: item.id });
        }
      }
      await startBatch({
        getState: get,
        sessionId,
        threadIds: [...rebuild.keys()],
        launchChoice: rebuildChoiceOf({
          choice,
          broken: broken.map(({ candidate }) => candidate),
        }),
      });
    } catch {
      return false;
    }
  }
  for (const { candidate } of broken) {
    await setResolveCandidateState({ db, candidateId: candidate.id, state: 'discarded' });
  }
  await loadResolveQueueItemsInto({ set, sessionId });
  await loadResolveCandidatesInto({ set, sessionId });
  return true;
};

export const reconcileResolveLane = async ({ set, get, sessionId }: Params): Promise<void> => {
  const candidates = await listResolveCandidates({ db: tauriDatabase, sessionId });
  const paths = [
    ...new Set(
      candidates
        .filter((candidate) => candidate.state === 'ready')
        .map((candidate) => candidate.worktreePath),
    ),
  ];
  for (const worktreePath of paths) {
    await reconcileLanePath({ set, get, sessionId, worktreePath });
  }
};
