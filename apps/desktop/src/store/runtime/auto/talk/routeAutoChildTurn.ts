import { CHECK_STATE } from '../../../slices/notifications/errorRecovery';
import { brandId } from '@goodboy/types';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  ProviderRunId,
  SessionId,
  TurnEvent,
  TurnState,
} from '@goodboy/types';
import { AUTO_MESSAGE_QUEUE_PREFIX } from '../../../../features/auto/AUTO_MESSAGE_QUEUE_PREFIX';
import {
  currentAutoChildTurnPort,
  type AutoChildTurnParams,
  type AutoChildTurnPort,
  type AutoChildTurnResult,
} from '../../../../features/auto/autoChildTurnPort';
import { QUEUE_DELIVERY_PREFIX } from '../../../slices/agentQueue/QUEUE_DELIVERY_PREFIX';
import type { AttachMountInput } from '../../../slices/project-mounts/types';
import type { ReportErrorParams } from '../../../slices/notifications/reportError';
import { ReportedError } from '../../../slices/notifications/reportedError';
import { AUTO_CONFINED_ROLE } from '../../../slices/turn/confinedRoleOf';
import type { SendTurnInput, SendTurnResult } from '../../../slices/turn/types';

type ChildTurnState = Readonly<{
  sessionPhaseRuns: Readonly<
    Record<SessionId, ReadonlyArray<Pick<Agent, 'id' | 'kind' | 'name' | 'parentAgentId'>>>
  >;
  agentTurnState: Readonly<Record<AgentId, TurnState>>;
  reportError: (params: ReportErrorParams) => Promise<void>;
  attachMount: (input: AttachMountInput) => Promise<unknown>;
  appendTurnEvent: (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => void;
}>;

export type RouteAutoChildTurnParams = Readonly<{
  get: () => ChildTurnState;
  input: SendTurnInput;
}>;

const BUSY_TURN_KINDS: ReadonlySet<string> = new Set(['starting', 'running']);

const CONTINUED: SendTurnResult = { blockedOverBudget: false };

const DROPPED: SendTurnResult = { blockedOverBudget: false, isAlreadySent: true };

const WORKING_MESSAGE =
  'This agent is still working for Auto. Your message waits: send it again when its turn ends.';

const LOST_MESSAGE = 'Goodboy could not reach Auto to continue this agent. Send it again.';

type RestoreRetryParams = {
  readonly get: () => ChildTurnState;
  readonly sessionId: SessionId;
  readonly restore: Readonly<{ mountId: string; mountName: string }>;
};

const restoreMountRetry =
  ({ get, sessionId, restore }: RestoreRetryParams) =>
  async (): Promise<boolean> => {
    try {
      await get().attachMount({
        sessionId,
        mountId: brandId<MountId>({ value: restore.mountId }),
      });
      return true;
    } catch (cause) {
      await get().reportError({
        recovery: CHECK_STATE,
        title: `The ${restore.mountName} folder is still missing`,
        error: cause,
        sessionId,
      });
      return false;
    }
  };

type RefuseChildTurnParams = {
  readonly get: () => ChildTurnState;
  readonly input: SendTurnInput;
  readonly name: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly restore?: Readonly<{ mountId: string; mountName: string }>;
};

const refuseChildTurn = async ({
  get,
  input,
  name,
  message,
  cause,
  restore,
}: RefuseChildTurnParams): Promise<never> => {
  const error = new ReportedError(message);
  await get().reportError({
    recovery: CHECK_STATE,
    title: `Your message did not reach ${name}`,
    error: cause ?? error,
    sessionId: input.sessionId,
    ...(restore === undefined
      ? {}
      : {
          retryLabel: `Restore ${restore.mountName}`,
          stays: 'Your message is kept. Restore the folder, then send it again.',
          retry: restoreMountRetry({ get, sessionId: input.sessionId, restore }),
        }),
  });
  throw error;
};

type AskParams = Omit<RefuseChildTurnParams, 'message' | 'cause'> & {
  readonly port: AutoChildTurnPort;
  readonly turn: AutoChildTurnParams;
};

const askAuto = async ({ port, turn, ...refusal }: AskParams): Promise<AutoChildTurnResult> => {
  try {
    return await port(turn);
  } catch (cause) {
    return refuseChildTurn({ ...refusal, message: LOST_MESSAGE, cause });
  }
};

export const routeAutoChildTurn = async ({
  get,
  input,
}: RouteAutoChildTurnParams): Promise<SendTurnResult | null> => {
  if ((input.origin !== undefined && input.origin !== 'operator') || input.agentId === undefined) {
    return null;
  }
  const agentId = input.agentId;
  const state = get();
  const runs = state.sessionPhaseRuns[input.sessionId] ?? [];
  const child = runs.find((candidate) => candidate.id === agentId);
  const root = runs.find((candidate) => candidate.id === child?.parentAgentId);
  if (child === undefined || root?.kind !== AUTO_CONFINED_ROLE) {
    return null;
  }
  const port = currentAutoChildTurnPort();
  if (port === null) {
    return null;
  }
  const refusal = { get, input, name: child.name };
  const deliveryId = input.deliveryId ?? '';
  const from = deliveryId.startsWith(`${QUEUE_DELIVERY_PREFIX}${AUTO_MESSAGE_QUEUE_PREFIX}`)
    ? 'auto-message'
    : 'user';
  const result = await askAuto({
    ...refusal,
    port,
    turn: {
      agentId,
      sessionId: input.sessionId,
      text: input.content,
      from,
      hasFiles: (input.attachments ?? []).length > 0,
      isBusy: BUSY_TURN_KINDS.has(state.agentTurnState[agentId]?.kind ?? 'idle'),
      deliveryId: input.deliveryId ?? null,
    },
  });
  if (result.kind === 'plain') {
    return from === 'auto-message' ? DROPPED : null;
  }
  if (result.kind === 'working') {
    return refuseChildTurn({ ...refusal, message: WORKING_MESSAGE });
  }
  if (result.kind === 'refused') {
    return refuseChildTurn({
      ...refusal,
      message: result.message,
      ...(result.restore === undefined ? {} : { restore: result.restore }),
    });
  }
  if (from === 'user') {
    get().appendTurnEvent(agentId, input.sessionId, {
      kind: 'operator_text',
      runId: brandId<ProviderRunId>({ value: `operator-${crypto.randomUUID()}` }),
      text: input.content,
      at: brandId<IsoDateTime>({ value: new Date().toISOString() }),
    });
  }
  input.onStarted?.();
  return CONTINUED;
};
