import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import { currentAutoUserTurnPort } from '../../../features/auto/autoUserTurnPort';
import type { ReportErrorParams } from '../../slices/notifications/reportError';
import { sessionById } from '../../slices/sessions/sessionIndex';
import { AUTO_CONFINED_ROLE } from '../../slices/turn/confinedRoleOf';
import type { SendTurnInput } from '../../slices/turn/types';

type NoticeState = Readonly<{
  sessions: ReadonlyArray<Pick<Session, 'id' | 'workspaceId'>>;
  sessionPhaseRuns: Readonly<
    Record<SessionId, ReadonlyArray<Pick<Agent, 'id' | 'kind' | 'name' | 'parentAgentId'>>>
  >;
  selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  reportError: (params: ReportErrorParams) => Promise<void>;
}>;

type Params = Readonly<{
  get: () => NoticeState;
  input: SendTurnInput;
}>;

export const noticeAutoOfChildTurn = async ({ get, input }: Params): Promise<void> => {
  if (input.origin !== undefined && input.origin !== 'operator') {
    return;
  }
  const port = currentAutoUserTurnPort();
  if (port === null) {
    return;
  }
  const state = get();
  const agentId = input.agentId ?? state.selectedAgentId[input.sessionId] ?? null;
  const runs = state.sessionPhaseRuns[input.sessionId] ?? [];
  const child = runs.find((candidate) => candidate.id === agentId);
  const root = runs.find((candidate) => candidate.id === child?.parentAgentId);
  const session = sessionById(state.sessions, input.sessionId);
  if (child === undefined || root?.kind !== AUTO_CONFINED_ROLE || session === undefined) {
    return;
  }
  const text = `I wrote to the ${child.name} you started: ${input.content}`;
  try {
    const result = await port({
      agentId: root.id,
      sessionId: input.sessionId,
      workspaceId: session.workspaceId,
      text,
    });
    if (result === 'lost') {
      throw new Error('Auto could not take the note. It sees the message in the agent chat.');
    }
  } catch (error) {
    await state.reportError({
      title: `Auto did not see what you told ${child.name}`,
      error,
      sessionId: input.sessionId,
    });
  }
};
