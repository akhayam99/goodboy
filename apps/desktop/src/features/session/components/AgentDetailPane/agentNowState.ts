import type { Agent, TurnEvent, TurnState } from '@goodboy/types';
import { agentStatusWord } from '../../agentStatusWord';
import { NEEDS_PERMISSION_WORD, effectiveAgentStatusOf } from '../../../workTreeModel/agentStateOf';
import { humanTurnErrorOf } from '../../../chat/humanTurnErrorOf';

type AgentNowState = {
  readonly label: string | null;
};

type RunningLabelParams = {
  readonly transcript: ReadonlyArray<TurnEvent>;
};

const runningLabel = ({ transcript }: RunningLabelParams): string => {
  const endedToolIds = new Set(
    transcript.filter((event) => event.kind === 'tool_call_end').map((event) => event.toolUseId),
  );
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const event = transcript[index];
    if (event?.kind === 'tool_call_start' && !endedToolIds.has(event.toolUseId)) {
      return event.toolName;
    }
    if (event?.kind === 'assistant_text') {
      return 'writing';
    }
  }
  return 'thinking';
};

type NowStateParams = {
  readonly agent: Agent;
  readonly turnState: TurnState | null;
  readonly transcript: ReadonlyArray<TurnEvent>;
  readonly isWaitingForWriter?: boolean;
};

type StatusParams = {
  readonly agent: Agent;
  readonly turnState: TurnState | null;
};

export const effectiveAgentStatus = ({ agent, turnState }: StatusParams): Agent['status'] =>
  effectiveAgentStatusOf({ agent, turn: turnState });

export const agentNowState = ({
  agent,
  turnState,
  transcript,
  isWaitingForWriter = false,
}: NowStateParams): AgentNowState => {
  if (isWaitingForWriter) {
    return { label: 'waiting for the writer' };
  }
  if (turnState?.kind === 'running' || (turnState === null && agent.status === 'running')) {
    return { label: runningLabel({ transcript }) };
  }

  if (turnState?.kind === 'blocked') {
    return { label: NEEDS_PERMISSION_WORD };
  }
  if (turnState?.kind === 'error') {
    return { label: humanTurnErrorOf({ message: turnState.message, agent }) };
  }
  if (agent.status === 'pending') {
    return { label: 'queued' };
  }
  if (turnState?.kind === 'starting') {
    return { label: 'starting' };
  }
  if (agent.status === 'failed' || agent.status === 'stopped') {
    return { label: agentStatusWord({ status: agent.status }) };
  }
  if (agent.status === 'running') {
    return { label: null };
  }
  return { label: 'ready' };
};
