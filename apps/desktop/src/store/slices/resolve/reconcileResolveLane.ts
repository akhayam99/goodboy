import {
  listResolveAttempts,
  listResolveCandidateItems,
  listResolveCandidates,
  listResolveQueueItems,
  setResolveCandidateState,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type {
  PrComment,
  ResolveAttempt,
  ResolveCandidate,
  ResolveLaunchChoice,
  ResolveQueueItemWithThread,
} from '@goodboy/types';
import { draftRoutingOf } from '../../../features/resolve/draftRouting';
import { LANE_REBUILD_HINT } from '../../../features/resolve/laneCopy';
import { launchChoiceOf } from '../../../features/resolve/launchChoice';
import { startBatch } from '../../../features/resolve/startBatch';
import { tauriDatabase } from '../../../shared/lib/db';
import { deferResolveQueueItem } from './deferResolveQueueItem';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { isLaneSourceMember } from './rebuildFailure/isLaneSourceMember';
import { recordLaneRebuildFailure } from './rebuildFailure/recordLaneRebuildFailure';
import { namedMountTarget } from './mountTarget';
import { isStaleMountError } from './rebuildFailure/isStaleMountError';
import { attemptOfCandidate, laneChainOf } from './resolveLane';
import { takeUpResolveQueueItem } from './takeUpResolveQueueItem';
import type { LaneParams, LaneSource, SessionParams, SliceParams } from './types';

type Params = SliceParams & LaneParams;

const REBUILDABLE = new Set(['none', 'deferred']);

type RebuildChoiceParams = {
  readonly choice: ResolveLaunchChoice;
  readonly broken: ReadonlyArray<ResolveCandidate>;
};

const rebuildChoiceOf = ({ choice, broken }: RebuildChoiceParams): ResolveLaunchChoice => {
  const earlier = broken.map((candidate) => candidate.candidateSha.slice(0, 9)).join(', ');
  const parts = [choice.hint, LANE_REBUILD_HINT, `Earlier attempts: ${earlier}.`];
  return {
    ...choice,
    hint: parts.filter((part): part is string => part !== null && part !== '').join('\n\n'),
  };
};

type KnownChoiceParams = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly broken: ReadonlyArray<ResolveCandidate>;
};

const knownChoiceOf = ({ attempts, broken }: KnownChoiceParams): ResolveLaunchChoice | null => {
  for (const candidate of broken) {
    const choice = attemptOfCandidate({ attempts, candidateId: candidate.id })?.launchChoice;
    if (choice != null) {
      return choice;
    }
  }
  return null;
};

type PathParams = SliceParams &
  SessionParams & {
    readonly source: LaneSource;
    readonly comments?: ReadonlyArray<PrComment>;
    readonly worktreePath: string;
  };

const reconcileLanePath = async ({
  set,
  get,
  sessionId,
  source,
  comments,
  worktreePath,
}: PathParams): Promise<boolean> => {
  const db = tauriDatabase;
  const candidates = await listResolveCandidates({ db, sessionId });
  const laneBroken = laneChainOf({
    candidates: candidates.map((candidate) => ({ candidate })),
    worktreePath,
  }).broken;
  const broken = laneBroken.filter(
    ({ candidate }) => candidate.mountTarget?.mountId === source.mountId,
  );
  if (broken.length === 0) {
    return false;
  }
  const entries = await listResolveQueueItems({ db, sessionId });
  const rebuild = new Map<string, ResolveQueueItemWithThread>();
  const brokenCandidates: Array<ResolveCandidate> = [];
  for (const { candidate } of broken) {
    const members = await listResolveCandidateItems({ db, candidateId: candidate.id });
    const memberEntries = members.flatMap((member) => {
      const entry = entries.find(({ item }) => item.id === member.queueItemId);
      return entry === undefined || !isLaneSourceMember({ entry, source }) ? [] : [entry];
    });
    if (source.kind !== undefined && memberEntries.length === 0) {
      continue;
    }
    brokenCandidates.push(candidate);
    for (const entry of memberEntries) {
      if (REBUILDABLE.has(entry.item.approvalState) && entry.thread.state !== 'closed') {
        rebuild.set(entry.thread.threadId, entry);
      }
    }
  }
  if (brokenCandidates.length === 0) {
    return false;
  }
  const mountRevision = namedMountTarget({
    get,
    sessionId,
    mountId: source.mountId,
  })?.mountRevision;
  const attempts = await listResolveAttempts({ db, sessionId });
  for (const candidate of brokenCandidates) {
    await setResolveCandidateState({ db, candidateId: candidate.id, state: 'discarded' });
  }
  await loadResolveCandidatesInto({ set, sessionId });
  if (rebuild.size > 0) {
    const choice =
      knownChoiceOf({ attempts, broken: brokenCandidates }) ??
      launchChoiceOf({
        routing: draftRoutingOf({ state: get(), sessionId }),
        commitStyle: null,
        hint: null,
      });
    const takenUp: Array<string> = [];
    const progress = { hasWritten: false };
    try {
      for (const { item } of rebuild.values()) {
        if (item.approvalState === 'deferred') {
          await takeUpResolveQueueItem({ set, get, sessionId, itemId: item.id });
          takenUp.push(item.id);
        }
      }
      await loadResolveQueueItemsInto({ set, sessionId });
      await startBatch({
        getState: get,
        sessionId,
        threadIds: [...rebuild.keys()],
        launchChoice: rebuildChoiceOf({ choice, broken: brokenCandidates }),
        mountId: source.mountId,
        ...(mountRevision !== undefined && { expectedMountRevision: mountRevision }),
        onWrite: () => {
          progress.hasWritten = true;
        },
        ...(comments !== undefined && { comments }),
      });
    } catch (error) {
      for (const itemId of takenUp) {
        await deferResolveQueueItem({
          set,
          get,
          sessionId,
          itemId,
          expectedState: 'none',
        }).catch(() => undefined);
      }
      const isStale = isStaleMountError({ error });
      if (!progress.hasWritten || isStale) {
        for (const candidate of brokenCandidates) {
          await setResolveCandidateState({ db, candidateId: candidate.id, state: candidate.state });
        }
      }
      if (progress.hasWritten && !isStale) {
        recordLaneRebuildFailure({
          set,
          sessionId,
          failure: {
            worktreePath,
            mountId: source.mountId,
            candidateIds: brokenCandidates.map((candidate) => candidate.id),
            message: formatError(error),
          },
        });
      }
      await loadResolveCandidatesInto({ set, sessionId });
    }
  }
  await loadResolveQueueItemsInto({ set, sessionId });
  return true;
};

export const reconcileResolveLane = async ({
  set,
  get,
  sessionId,
  source: named,
  comments,
}: Params): Promise<void> => {
  const candidates = await listResolveCandidates({ db: tauriDatabase, sessionId });
  const lanes = new Map<string, LaneSource>();
  for (const candidate of candidates) {
    const mountId = candidate.mountTarget?.mountId;
    if (candidate.state !== 'ready' || mountId === undefined) {
      continue;
    }
    if (named !== undefined && named.mountId !== mountId) {
      continue;
    }
    lanes.set(`${mountId}\n${candidate.worktreePath}`, named ?? { mountId });
  }
  for (const [key, source] of lanes) {
    await reconcileLanePath({
      set,
      get,
      sessionId,
      source,
      worktreePath: key.slice(key.indexOf('\n') + 1),
      ...(comments !== undefined && { comments }),
    });
  }
};
