import type { Tone } from '@goodboy/ui';
import type { Agent, TurnEvent, TurnState } from '@goodboy/types';

type AgentNowState = {
  readonly tone: Tone;
  readonly label: string;
  readonly isPulsing: boolean;
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

export const agentNowState = ({ agent, turnState, transcript }: NowStateParams): AgentNowState => {
  if (turnState?.kind === 'running') {
    return { tone: 'info', label: runningLabel({ transcript }), isPulsing: true };
  }
  if (turnState?.kind === 'blocked') {
    return { tone: 'warning', label: 'waiting on a permission decision', isPulsing: false };
  }
  if (turnState?.kind === 'error') {
    return { tone: 'danger', label: turnState.message, isPulsing: false };
  }
  if (agent.status === 'pending') {
    return { tone: 'neutral', label: 'queued', isPulsing: false };
  }
  return { tone: 'neutral', label: 'ready', isPulsing: false };
};
