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
  return events.some((event) => event.kind === 'decision_note' && visitorRuns.has(event.runId));
};

const TASK_START = '[data-demo-anchor="task-start"]';
const DRAFT_START = '[data-demo-anchor="draft-start"]';

const ISSUE = 'HBL-412';

const sessionIdsOf = ({ state }: StateParams): ReadonlySet<string> =>
  new Set(state.sessions.map((session) => session.id));

const hasNewIssueSession = ({ state, start }: HintProbe): boolean => {
  const known = sessionIdsOf({ state: start });
  return state.sessions.some(
    (session) =>
      !known.has(session.id) &&
      (state.sessionExternalTasks[session.id] ?? []).some((task) => task.identifier === ISSUE),
  );
};

const OPERATIONS = 'button[aria-label^="Operations"]';
const CLAUDE_LIMITS = 'button[aria-label^="Claude limits"]';
const COMPOSER = 'textarea[aria-label="Message to the agent"]';

export const AGENT_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'agent-issue',
    label: 'Start from the issue',
    copy: 'Start from HBL-412',
    instruction: 'Press Start session on HBL-412: the agent takes the Linear issue as its brief.',
    result: 'The session started from HBL-412 and the agent is working on its own branch.',
    progress: 'HBL-412 is picked with its description as the brief. Press Start Implementer.',
    beat: 0,
    anchor: ({ root }) => (hasElement({ root, selector: DRAFT_START }) ? DRAFT_START : TASK_START),
    side: 'bottom',
    revealWhen: ({ root }) =>
      hasElement({ root, selector: TASK_START }) || hasElement({ root, selector: DRAFT_START }),
    doneWhen: hasNewIssueSession,
  },
  {
    id: 'agent-answer',
    label: 'Answer its question',
    copy: 'The agent is waiting on you',
    instruction: 'Answer the agent question: it is waiting and cannot go on without you.',
    result: 'The agent has your answer: it updates ledger-core and reruns the redelivery test.',
    beat: 1,
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
    instruction: 'Open the Claude limits chip in the top bar to see how much of the plan is left.',
    result:
      'Claude used its whole 5-hour window and 84% of the week, Codex 58% of the week: Claude cannot take the next message.',
    beat: 1,
    anchor: CLAUDE_LIMITS,
    side: 'bottom',
    revealWhen: ({ root }) => hasElement({ root, selector: CLAUDE_LIMITS }),
    doneWhen: ({ isAnchorClicked }) => isAnchorClicked,
  },
  {
    id: 'agent-limits',
    label: 'Continue on Codex',
    copy: 'Type a message, then Send',
    instruction: 'Type a message and press Send: Claude is out of limit, so Codex picks it up.',
    result: 'Claude hit its limit, so Codex took the same brief and is rerunning the suites.',
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
    result: 'The edited files are listed with what changed in each.',
    beat: 1,
    anchor: OPERATIONS,
    revealWhen: ({ state }) => !isAgentBusy({ state }),
    doneWhen: ({ root, isAnchorClicked }) =>
      isAnchorClicked || root.querySelector(`${OPERATIONS}[aria-expanded="true"]`) !== null,
  },
];
