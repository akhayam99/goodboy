import type { Agent, TurnEvent, TurnState } from '@goodboy/types';
import { proposalOf } from './proposalOf';

type Params = {
  readonly agent: Agent;
  readonly events: ReadonlyArray<TurnEvent>;
  readonly turnState?: TurnState;
};

export const checkAnalysisOf = ({ agent, events, turnState }: Params) => {
  const lastUserIndex = events.reduce(
    (latest, event, index) => (event.kind === 'user_text' ? index : latest),
    -1,
  );
  const turn = events.slice(lastUserIndex + 1);
  const text = turn
    .filter((event) => event.kind === 'assistant_text')
    .map((event) => event.delta)
    .join('');
  const proposal = proposalOf({ text });
  const isRunning =
    turnState?.kind === 'starting' ||
    turnState?.kind === 'running' ||
    turnState?.kind === 'blocked' ||
    ((turnState === undefined || turnState.kind === 'idle') &&
      (agent.status === 'running' || agent.status === 'pending'));
  const last = [...turn]
    .reverse()
    .find(
      (event) =>
        event.kind === 'assistant_text' ||
        event.kind === 'tool_call_start' ||
        event.kind === 'error',
    );
  const activity =
    last?.kind === 'tool_call_start'
      ? last.toolName
      : last?.kind === 'error'
        ? last.message
        : (text
            .trim()
            .split('\n')
            .reverse()
            .find((line) => line.trim().length > 0) ?? 'Starting the analysis');
  return {
    text,
    proposal,
    isRunning,
    activity,
    label: isRunning
      ? 'Debugger is analyzing'
      : proposal === null
        ? 'Debugger found no fix'
        : 'Debugger proposes a fix',
    kickoff: events.find((event) => event.kind === 'user_text')?.text ?? '',
  };
};
