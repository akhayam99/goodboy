import type { Agent, TurnEvent, TurnState } from '@goodboy/types';
import { agentStatusWord } from '../../agentStatusWord';

type AgentNowState = {
  readonly label: string;
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
};

type StatusParams = {
  readonly agent: Agent;
  readonly turnState: TurnState | null;
};

export const effectiveAgentStatus = ({ agent, turnState }: StatusParams): Agent['status'] =>
  turnState?.kind === 'running' ? 'running' : agent.status;

export const agentNowState = ({ agent, turnState, transcript }: NowStateParams): AgentNowState => {
  if (turnState?.kind === 'running' || (turnState === null && agent.status === 'running')) {
    return { label: runningLabel({ transcript }) };
  }
  if (turnState?.kind === 'blocked') {
    return { label: 'Needs approval' };
  }
  if (turnState?.kind === 'error') {
    return { label: turnState.message };
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
  return { label: 'ready' };
};
