import { formatError } from '@goodboy/ui';
import type { SendTurnInput, SendTurnResult } from '../turn/types';
import type { DeliveryRun, LookupDeliveryRunParams, TurnExit } from './ports';

export const DELIVERED_TURN_POLL_MS = 50;
export const DELIVERED_TURN_FAST_POLLS = 40;
export const DELIVERED_TURN_SLOW_POLL_MS = 500;

type PollPlanParams = {
  readonly acceptTimeoutMs: number;
};

export const pollCountOf = ({ acceptTimeoutMs }: PollPlanParams): number => {
  const fastMs = DELIVERED_TURN_FAST_POLLS * DELIVERED_TURN_POLL_MS;
  if (acceptTimeoutMs <= fastMs) {
    return Math.ceil(acceptTimeoutMs / DELIVERED_TURN_POLL_MS);
  }
  return (
    DELIVERED_TURN_FAST_POLLS + Math.ceil((acceptTimeoutMs - fastMs) / DELIVERED_TURN_SLOW_POLL_MS)
  );
};

type PollIntervalParams = {
  readonly poll: number;
};

export const pollIntervalOf = ({ poll }: PollIntervalParams): number =>
  poll < DELIVERED_TURN_FAST_POLLS ? DELIVERED_TURN_POLL_MS : DELIVERED_TURN_SLOW_POLL_MS;

export type ReadRunCostParams = Readonly<{ runId: string }>;

export type SleepParams = Readonly<{ ms: number }>;

export type DeliveredTurnDeps = Readonly<{
  sendTurn: (input: SendTurnInput) => Promise<SendTurnResult>;
  lookupDeliveryRun: (params: LookupDeliveryRunParams) => Promise<DeliveryRun | null>;
  readRunCostUsd: (params: ReadRunCostParams) => Promise<number | null>;
  sleep: (params: SleepParams) => Promise<void>;
  nowMs: () => number;
}>;

export type DeliveredTurnEnded = Readonly<{
  assistantText: string;
  exit: TurnExit;
  costUsd: number | null;
  filesTouched: ReadonlyArray<string>;
  durationMs: number;
}>;

export type DeliveredTurnOutcome =
  | Readonly<{ kind: 'started'; runId: string }>
  | Readonly<{ kind: 'duplicate'; runId: string }>
  | Readonly<{ kind: 'refused'; message: string; isLeaseDenied: boolean }>;

export type StartDeliveredTurnParams = Readonly<{
  deps: DeliveredTurnDeps;
  input: Omit<SendTurnInput, 'onSettled' | 'runId' | 'deliveryId'>;
  runId: SendTurnInput['runId'];
  deliveryId: string;
  acceptTimeoutMs: number;
  onEnded: (ended: DeliveredTurnEnded) => void;
}>;

type Captured = Readonly<{
  assistantText: string;
  exit: TurnExit;
  filesTouched: ReadonlyArray<string>;
}>;

type ExitParams = {
  readonly hasFailed: boolean;
  readonly wasCancelled: boolean;
};

const exitOf = ({ hasFailed, wasCancelled }: ExitParams): TurnExit => {
  if (wasCancelled) {
    return 'cancelled';
  }
  return hasFailed ? 'error' : 'ok';
};

type CostOfParams = {
  readonly deps: DeliveredTurnDeps;
  readonly runId: string;
};

const costOf = async ({ deps, runId }: CostOfParams): Promise<number | null> => {
  try {
    return await deps.readRunCostUsd({ runId });
  } catch {
    return null;
  }
};

export const startDeliveredTurn = async ({
  deps,
  input,
  runId,
  deliveryId,
  acceptTimeoutMs,
  onEnded,
}: StartDeliveredTurnParams): Promise<DeliveredTurnOutcome> => {
  const startedAt = deps.nowMs();
  let isAccepted = false;
  let isEndReported = false;
  let isSendFinished = false;
  let sendFailure: string | null = null;
  const held: { refusal: Readonly<{ message: string; isLeaseDenied: boolean }> | null } = {
    refusal: null,
  };
  let captured: Captured | null = null;
  const reportEnd = async (): Promise<void> => {
    if (!isAccepted || isEndReported || (captured === null && !isSendFinished)) {
      return;
    }
    isEndReported = true;
    const costUsd = runId === undefined ? null : await costOf({ deps, runId });
    onEnded({
      assistantText: captured?.assistantText ?? '',
      exit: captured?.exit ?? (sendFailure === null ? 'ok' : 'error'),
      costUsd,
      filesTouched: captured?.filesTouched ?? [],
      durationMs: Math.max(0, deps.nowMs() - startedAt),
    });
  };
  void deps
    .sendTurn({
      ...input,
      ...(runId === undefined ? {} : { runId }),
      deliveryId,
      onSettled: (settled) => {
        captured = {
          assistantText: settled.assistantText,
          exit: exitOf({ hasFailed: settled.hasFailed, wasCancelled: settled.wasCancelled }),
          filesTouched: settled.filesTouched,
        };
        void reportEnd();
      },
    })
    .then((result) => {
      if (result.blockedOverBudget) {
        held.refusal = {
          message: 'The budget of this conversation does not cover another turn.',
          isLeaseDenied: false,
        };
      }
      if (result.isWriterLeaseDenied === true) {
        held.refusal = {
          message: 'The writer lease stayed busy for too long.',
          isLeaseDenied: true,
        };
      }
    })
    .catch((error: unknown) => {
      sendFailure = formatError(error);
    })
    .then(() => {
      isSendFinished = true;
      return reportEnd();
    });
  const polls = pollCountOf({ acceptTimeoutMs });
  for (let poll = 0; poll < polls; poll += 1) {
    const run = await deps.lookupDeliveryRun({ deliveryId });
    if (run !== null) {
      isAccepted = run.runId === runId;
      void reportEnd();
      return isAccepted
        ? { kind: 'started', runId: run.runId }
        : { kind: 'duplicate', runId: run.runId };
    }
    if (isSendFinished) {
      return {
        kind: 'refused',
        message: sendFailure ?? held.refusal?.message ?? 'The turn could not start.',
        isLeaseDenied: held.refusal?.isLeaseDenied === true,
      };
    }
    await deps.sleep({ ms: pollIntervalOf({ poll }) });
  }
  return { kind: 'refused', message: 'The turn did not start in time.', isLeaseDenied: false };
};
