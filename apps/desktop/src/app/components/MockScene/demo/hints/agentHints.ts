import { isOpenQuestionAnswerText } from '@goodboy/core';
import type { TurnEvent } from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';

type StateParams = {
  readonly state: AppStore;
};

const userTurnsOf = ({ state }: StateParams): number =>
  Object.values(state.transcripts)
    .flat()
    .filter((event) => event.kind === 'user_text' && !isOpenQuestionAnswerText(event.text)).length;

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

const hasDraft = ({ state }: StateParams): boolean => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return false;
  }
  const agentId = state.selectedAgentId[sessionId];
  if (agentId === null || agentId === undefined) {
    return false;
  }
  return (state.agentDraft[agentId] ?? '').trim().length > 0;
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

const hasHandoff = ({ state }: StateParams): boolean =>
  transcriptOf({ state }).some((event) => event.kind === 'decision_note');

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

const hasSent = ({ state, start }: HintProbe): boolean =>
  userTurnsOf({ state }) > userTurnsOf({ state: start });

const OPERATIONS = 'button[aria-label^="Operations"]';
const CLAUDE_LIMITS = 'button[aria-label^="Claude limits"]';
const MODEL = 'button[aria-label^="Model routing"]';

export const AGENT_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'agent-send',
    copy: 'Send this follow-up to the agent',
    outcome: 'turn-replied',
    anchor: 'button[aria-label="Send message"]',
    side: 'left',
    revealWhen: ({ state }) => hasDraft({ state }),
    doneWhen: (probe) => hasSent(probe) && !isAgentBusy({ state: probe.state }),
  },
  {
    id: 'agent-answer',
    copy: 'Answer the agent’s question',
    outcome: 'question-answered',
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
    copy: 'Open the Claude limits',
    outcome: null,
    anchor: CLAUDE_LIMITS,
    side: 'bottom',
    revealWhen: ({ state, root }) =>
      hasElement({ root, selector: CLAUDE_LIMITS }) && !hasHandoff({ state }),
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
  {
    id: 'agent-limits',
    copy: 'Send a message and watch Codex take over from Claude',
    outcome: 'task-continued',
    anchor: 'textarea[aria-label="Message to the agent"]',
    side: 'top',
    revealWhen: ({ state }) => hasHandoff({ state }) && !isAgentBusy({ state }),
    doneWhen: isVisitorHandoffDone,
  },
  {
    id: 'agent-files',
    copy: 'Open the files it edited',
    outcome: 'files-opened',
    anchor: OPERATIONS,
    revealWhen: ({ state }) => !isAgentBusy({ state }),
    doneWhen: ({ root, isAnchorClicked }) =>
      isAnchorClicked || root.querySelector(`${OPERATIONS}[aria-expanded="true"]`) !== null,
  },
  {
    id: 'agent-model',
    copy: 'Open the model picker',
    outcome: null,
    anchor: MODEL,
    side: 'top',
    revealWhen: ({ state, root }) =>
      !isAgentBusy({ state }) && hasElement({ root, selector: MODEL }),
    doneWhen: ({ root, isAnchorClicked }) =>
      isAnchorClicked || root.querySelector(`${MODEL}[aria-expanded="true"]`) !== null,
  },
];
