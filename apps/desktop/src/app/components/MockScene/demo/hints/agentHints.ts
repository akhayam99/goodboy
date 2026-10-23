import { isOpenQuestionAnswerText } from '@goodboy/core';
import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from './demoHintTypes';

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

const hasSent = ({ state, start }: HintProbe): boolean =>
  userTurnsOf({ state }) > userTurnsOf({ state: start });

const OPERATIONS = 'button[aria-label^="Operations"]';

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
      return id === null ? null : `[data-oq-anchor="${CSS.escape(id)}"] [role="radiogroup"]`;
    },
    side: 'top',
    revealWhen: ({ state }) => blockingQuestionOf({ state }) !== null && !isAgentBusy({ state }),
    doneWhen: ({ state, start }) => answeredOf({ state }) > answeredOf({ state: start }),
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
];
