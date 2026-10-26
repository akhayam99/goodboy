import type { TurnEvent } from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';

type StateParams = {
  readonly state: AppStore;
};

const answeredOf = ({ state }: StateParams): number => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return 0;
  }
  return [
    ...(state.sessionOpenQuestions[sessionId] ?? []),
    ...(state.sessionAnsweredQuestions[sessionId] ?? []),
  ].filter((question) => question.status === 'answered').length;
};

const isAgentBusy = ({ state }: StateParams): boolean => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return false;
  }
  const agentId = state.selectedAgentId[sessionId];
  if (agentId === null || agentId === undefined) {
    return false;
  }
  return state.agentTurnState[agentId]?.kind === 'running';
};

const blockingQuestionOf = ({ state }: StateParams): string | null => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return null;
  }
  const question = (state.sessionOpenQuestions[sessionId] ?? []).find(
    (entry) => entry.isBlocking && entry.status === 'open',
  );
  return question?.id ?? null;
};

const transcriptOf = ({ state }: StateParams): ReadonlyArray<TurnEvent> => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return [];
  }
  const agentId = state.selectedAgentId[sessionId];
  if (agentId === null || agentId === undefined) {
    return [];
  }
  return state.transcripts[agentId] ?? [];
};

const isVisitorHandoffDone = ({ state, start }: HintProbe): boolean => {
  const before = new Set(transcriptOf({ state: start }).map((event) => event.runId));
  const events = transcriptOf({ state });
  const visitorRuns = new Set(
    events.flatMap((event) =>
      event.kind === 'user_text' && !before.has(event.runId) ? [event.runId] : [],
    ),
  );
  return (
    !isAgentBusy({ state }) &&
    events.some((event) => event.kind === 'decision_note' && visitorRuns.has(event.runId))
  );
};

const OPERATIONS = 'button[aria-label^="Operations"]';
const CLAUDE_LIMITS = 'button[aria-label^="Claude limits"]';
const COMPOSER = 'textarea[aria-label="Message to the agent"]';

export const AGENT_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'agent-answer',
    label: 'Answer its question',
    copy: 'The agent is waiting on you',
    instruction: 'Pick an answer to the agent question so it can carry on with the task.',
    result: 'The agent has your answer and carries on with the task.',
    beat: 0,
    anchor: ({ state }) => {
      const id = blockingQuestionOf({ state });
      return id === null ? null : `[data-oq-anchor="${CSS.escape(id)}"]`;
    },
    side: 'top',
    revealWhen: ({ state }) => blockingQuestionOf({ state }) !== null && !isAgentBusy({ state }),
    doneWhen: ({ state, start }) => answeredOf({ state }) > answeredOf({ state: start }),
  },
  {
    id: 'agent-limits-peek',
    label: 'Check the limits',
    copy: 'Check what is left',
    instruction: 'Open the limits chip to see how much of your Claude plan you have left.',
    result: 'Claude is at its weekly limit: it can run out in the middle of a task.',
    beat: 1,
    anchor: CLAUDE_LIMITS,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: CLAUDE_LIMITS }),
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
  {
    id: 'agent-limits',
    label: 'Continue on Codex',
    copy: 'Codex takes over',
    instruction:
      'Claude hit its limit: send a message and watch Codex continue with the same brief.',
    result: 'Codex took over with the same brief Claude had.',
    beat: 1,
    anchor: COMPOSER,
    side: 'top',
    revealWhen: ({ state }) => !isAgentBusy({ state }),
    doneWhen: isVisitorHandoffDone,
  },
  {
    id: 'agent-files',
    label: 'Open the edited files',
    copy: 'Files it edited',
    instruction: 'Open Operations to see which files the agent edited and what changed in them.',
    result: 'The files the agent edited are listed with what changed in each.',
    beat: 1,
    anchor: OPERATIONS,
    revealWhen: ({ state }) => !isAgentBusy({ state }),
    doneWhen: ({ root, isAnchorClicked }) =>
      isAnchorClicked || root.querySelector(`${OPERATIONS}[aria-expanded="true"]`) !== null,
  },
];
