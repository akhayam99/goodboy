import { formatError } from '@goodboy/ui';
import type { MountId, PrMergeMethod, ProjectId, PullRequestView, SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { selectMountById } from '../project-mounts/selectors';
import { pullRequestPortFor } from '../review-source/pullRequestPortFor';
import { mergeBlockerOf, type MergeBlockerKind } from './mergeBlockerOf';

export type MergeEntry = Readonly<{
  sessionId: SessionId;
  mountId: MountId;
  prNumber: number;
  label: string;
}>;

export type MergeStepKind = 'merging' | 'updating' | 'waiting';

export type MergeStep = Readonly<{
  kind: MergeStepKind;
  index: number;
}>;

export type MergeStopKind =
  MergeBlockerKind | 'unreachable' | 'method' | 'refused' | 'update' | 'timeout';

export type MergeInOrderResult =
  | Readonly<{ kind: 'done'; merged: number }>
  | Readonly<{ kind: 'halted'; merged: number }>
  | Readonly<{
      kind: 'stopped';
      merged: number;
      index: number;
      stop: MergeStopKind;
      reason: string;
      isWithLead: boolean;
    }>;

export type MergeInOrderParams = Readonly<{
  entries: ReadonlyArray<MergeEntry>;
  method: PrMergeMethod | null;
  shouldUpdate: boolean;
  shouldWait: boolean;
  shouldHandConflicts: boolean;
  shouldStop?: () => boolean;
  onStep?: (step: MergeStep) => void;
}>;

export const MERGE_WAIT = {
  pollMs: 20_000,
  maxMs: 45 * 60_000,
  quietReads: 3,
} as const;

type SleepParams = {
  readonly ms: number;
};

const sleepFor = ({ ms }: SleepParams): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type Deps = Pick<SliceDeps, 'get'> & {
  readonly portFor?: typeof pullRequestPortFor;
  readonly sleep?: (params: SleepParams) => Promise<void>;
  readonly now?: () => number;
};

type StopParams = {
  readonly merged: number;
  readonly index: number;
  readonly stop: MergeStopKind;
  readonly reason: string;
  readonly isWithLead?: boolean;
};

type StopAtParams = Omit<StopParams, 'merged' | 'index'>;

const stopped = ({
  merged,
  index,
  stop,
  reason,
  isWithLead = false,
}: StopParams): MergeInOrderResult => ({
  kind: 'stopped',
  merged,
  index,
  stop,
  reason,
  isWithLead,
});

const METHOD_WORD: Readonly<Record<PrMergeMethod, string>> = {
  squash: 'Squash and merge',
  merge: 'Merge commit',
  rebase: 'Rebase and merge',
};

type ProjectParams = {
  readonly get: Deps['get'];
  readonly entry: MergeEntry;
};

const projectOf = ({ get, entry }: ProjectParams): ProjectId | null =>
  selectMountById({ state: get(), sessionId: entry.sessionId, mountId: entry.mountId })
    ?.projectId ?? null;

type UpdateFailureParams = {
  readonly get: Deps['get'];
  readonly mountId: MountId;
  readonly outcome: string;
};

const updateFailureOf = ({ get, mountId, outcome }: UpdateFailureParams): string => {
  if (outcome === 'busy') {
    return 'another rebase runs on this branch';
  }
  if (outcome === 'stopped') {
    return get().historyRuns[mountId]?.stop?.message ?? 'the update stopped';
  }
  return outcome;
};

export const mergeInOrder =
  ({ get, portFor = pullRequestPortFor, sleep = sleepFor, now = Date.now }: Deps) =>
  async ({
    entries,
    method,
    shouldUpdate,
    shouldWait,
    shouldHandConflicts,
    shouldStop = () => false,
    onStep = () => undefined,
  }: MergeInOrderParams): Promise<MergeInOrderResult> => {
    const touched = new Set<ProjectId>();
    let merged = 0;
    for (const [index, entry] of entries.entries()) {
      if (index > 0 && shouldStop()) {
        return { kind: 'halted', merged };
      }
      const { sessionId, mountId, prNumber, label } = entry;
      const stopAt = ({ stop, reason, isWithLead }: StopAtParams) =>
        stopped({
          merged,
          index,
          stop,
          reason,
          ...(isWithLead === undefined ? {} : { isWithLead }),
        });
      const port = portFor({ get, sessionId, mountId, prNumber });
      if (port === null) {
        return stopAt({ stop: 'unreachable', reason: "Goodboy can't reach its host from here" });
      }
      const project = projectOf({ get, entry });
      const handOver = async (): Promise<MergeInOrderResult> => {
        if (!shouldHandConflicts) {
          return stopAt({ stop: 'conflict', reason: `${label} has conflicts` });
        }
        try {
          await get().resolveRebaseWithAuto({
            sessionId,
            mountIds: [mountId],
            tidyMountIds: [],
            hint: '',
          });
        } catch (error) {
          return stopAt({
            stop: 'conflict',
            reason: `${label} has conflicts and the Lead could not start: ${formatError(error)}`,
          });
        }
        return stopAt({
          stop: 'conflict',
          reason: `${label} has conflicts. The Lead has it`,
          isWithLead: true,
        });
      };
      const update = async (): Promise<MergeInOrderResult | null> => {
        onStep({ kind: 'updating', index });
        const outcome = await get()
          .rebaseBranch({ sessionId, mountId })
          .catch((error: unknown) => formatError(error));
        if (outcome === 'rebased') {
          return null;
        }
        if (outcome === 'conflict') {
          return handOver();
        }
        return stopAt({
          stop: 'update',
          reason: `${label} could not be updated: ${updateFailureOf({ get, mountId, outcome })}`,
        });
      };
      try {
        let quietReads = 0;
        if (shouldUpdate && project !== null && touched.has(project)) {
          const failed = await update();
          if (failed !== null) {
            return failed;
          }
          quietReads = MERGE_WAIT.quietReads;
        }
        onStep({ kind: 'merging', index });
        const startedAt = now();
        let view: PullRequestView = await port.read();
        let blocker = mergeBlockerOf({ view });
        if (blocker?.kind === 'conflict' && shouldUpdate) {
          const failed = await update();
          if (failed !== null) {
            return failed;
          }
          quietReads = MERGE_WAIT.quietReads;
          view = await port.read();
          blocker = mergeBlockerOf({ view });
        }
        const isAwaitingChecks = (): boolean =>
          blocker?.kind === 'pending' ||
          (blocker === null && quietReads > 0 && view.checks.runs.length === 0);
        while (shouldWait && isAwaitingChecks()) {
          if (now() - startedAt >= MERGE_WAIT.maxMs) {
            return stopAt({ stop: 'timeout', reason: `${label} still has checks running` });
          }
          onStep({ kind: 'waiting', index });
          await sleep({ ms: MERGE_WAIT.pollMs });
          quietReads = view.checks.runs.length === 0 ? quietReads - 1 : 0;
          view = await port.read();
          blocker = mergeBlockerOf({ view });
        }
        if (blocker?.kind === 'conflict' && shouldUpdate) {
          return handOver();
        }
        if (blocker !== null) {
          return stopAt({ stop: blocker.kind, reason: `${label} ${blocker.text}` });
        }
        const chosen = method ?? view.mergeMethods[0] ?? 'squash';
        if (!view.mergeMethods.includes(chosen)) {
          return stopAt({
            stop: 'method',
            reason: `${label}: ${METHOD_WORD[chosen]} is turned off for this repository`,
          });
        }
        await get().mergePr(sessionId, view.number, chosen, {
          mountId,
          expectedHeadSha: view.headSha,
        });
      } catch (error) {
        return stopAt({ stop: 'refused', reason: formatError(error) });
      }
      merged += 1;
      if (project !== null) {
        touched.add(project);
      }
    }
    return { kind: 'done', merged };
  };
