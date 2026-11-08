import { CHECK_STATE } from '../../../slices/notifications/errorRecovery';
import { brandId } from '@goodboy/types';
import type {
  Agent,
  AgentId,
  IsoDateTime,
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
  appendTurnEvent: (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => void;
}>;

export type RouteAutoChildTurnParams = Readonly<{
  get: () => ChildTurnState;
  input: SendTurnInput;
}>;

const QUEUE_DELIVERY_PREFIX = 'queue:';

const BUSY_TURN_KINDS: ReadonlySet<string> = new Set(['starting', 'running']);

const CONTINUED: SendTurnResult = { blockedOverBudget: false };

const DROPPED: SendTurnResult = { blockedOverBudget: false, isAlreadySent: true };

const WORKING_MESSAGE =
  'This agent is still working for Auto. Your message waits: send it again when its turn ends.';

const LOST_MESSAGE = 'Goodboy could not reach Auto to continue this agent. Send it again.';

type RefuseChildTurnParams = {
  readonly get: () => ChildTurnState;
  readonly input: SendTurnInput;
  readonly name: string;
  readonly message: string;
  readonly cause?: unknown;
};

const refuseChildTurn = async ({
  get,
  input,
  name,
  message,
  cause,
}: RefuseChildTurnParams): Promise<never> => {
  const error = new ReportedError(message);
  await get().reportError({
    recovery: CHECK_STATE,
    title: `Your message did not reach ${name}`,
    error: cause ?? error,
    sessionId: input.sessionId,
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
  if (BUSY_TURN_KINDS.has(state.agentTurnState[agentId]?.kind ?? 'idle')) {
    return refuseChildTurn({ ...refusal, message: WORKING_MESSAGE });
  }
  const result = await askAuto({
    ...refusal,
    port,
    turn: {
      agentId,
      sessionId: input.sessionId,
      text: input.content,
      from,
      hasFiles: (input.attachments ?? []).length > 0,
    },
  });
  if (result.kind === 'plain') {
    return from === 'auto-message' ? DROPPED : null;
  }
  if (result.kind === 'working') {
    return refuseChildTurn({ ...refusal, message: WORKING_MESSAGE });
  }
  if (result.kind === 'refused') {
    return refuseChildTurn({ ...refusal, message: result.message });
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
