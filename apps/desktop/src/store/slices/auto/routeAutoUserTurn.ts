import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import type { ReportErrorParams } from '../notifications/reportError';
import { currentAutoUserTurnPort } from '../../../features/auto/autoUserTurnPort';
import { sessionById } from '../sessions/sessionIndex';
import { ReportedError } from '../notifications/reportedError';
import { AUTO_CONFINED_ROLE } from '../turn/confinedRoleOf';
import type { SendTurnInput, SendTurnResult } from '../turn/types';

export type AutoTurnState = Readonly<{
  sessions: ReadonlyArray<Pick<Session, 'id' | 'workspaceId'>>;
  sessionPhaseRuns: Readonly<
    Record<SessionId, ReadonlyArray<Pick<Agent, 'id' | 'kind' | 'parentAgentId'>>>
  >;
  selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  reportError: (params: ReportErrorParams) => Promise<void>;
}>;

export type RouteAutoUserTurnParams = Readonly<{
  get: () => AutoTurnState;
  input: SendTurnInput;
}>;

export const AUTO_ATTACHMENTS_MESSAGE = 'Auto does not take files in a message yet.';
export const AUTO_MESSAGE_LOST_MESSAGE =
  'Auto could not take your message. Send it again in a moment.';

const REFUSED_TITLE = "Auto didn't get your message";

type RefuseParams = {
  readonly get: () => AutoTurnState;
  readonly input: SendTurnInput;
  readonly message: string;
};

const refuse = async ({ get, input, message }: RefuseParams): Promise<never> => {
  const error = new ReportedError(message);
  await get().reportError({ title: REFUSED_TITLE, error, sessionId: input.sessionId });
  throw error;
};

const QUEUED: SendTurnResult = { blockedOverBudget: false };

export const routeAutoUserTurn = async ({
  get,
  input,
}: RouteAutoUserTurnParams): Promise<SendTurnResult | null> => {
  if (input.origin !== undefined && input.origin !== 'operator') {
    return null;
  }
  const port = currentAutoUserTurnPort();
  if (port === null) {
    return null;
  }
  const state = get();
  const agentId = input.agentId ?? state.selectedAgentId[input.sessionId] ?? null;
  if (agentId === null) {
    return null;
  }
  const agent = (state.sessionPhaseRuns[input.sessionId] ?? []).find(
    (candidate) => candidate.id === agentId,
  );
  if (
    agent === undefined ||
    agent.kind !== AUTO_CONFINED_ROLE ||
    agent.parentAgentId !== undefined
  ) {
    return null;
  }
  const session = sessionById(state.sessions, input.sessionId);
  if (session === undefined) {
    return null;
  }
  if ((input.attachments ?? []).length > 0) {
    return refuse({ get, input, message: AUTO_ATTACHMENTS_MESSAGE });
  }
  const result = await port({
    agentId,
    sessionId: input.sessionId,
    workspaceId: session.workspaceId,
    text: input.content,
  });
  if (result === 'lost') {
    return refuse({ get, input, message: AUTO_MESSAGE_LOST_MESSAGE });
  }
  input.onStarted?.();
  return QUEUED;
};
