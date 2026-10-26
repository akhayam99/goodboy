import {
  brandId,
  type Agent,
  type AgentId,
  type MountId,
  type OpenQuestion,
  type OpenQuestionId,
  type ProviderRunId,
  type SessionProjectMount,
  type TurnEvent,
} from '@goodboy/types';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { BOARD_STORY_SESSION } from '../../scenes/BoardScene';
import { GUARD_BRANCH, ORCHESTRATE_GOAL, TESTS_BRANCH } from './autoStory';
import { storyMountOf } from './storyMountOf';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

const AGENT_ID = brandId<AgentId>({ value: 'demo-board-story-agent' });
const RUN_ID = brandId<ProviderRunId>({ value: 'demo-board-story-run' });

const BOARD_STORY_QUESTION = {
  text: 'All three branches pass. Review the diff first, or push them now and open the pull request?',
  answers: ['Review the diff first', 'Push and open the pull request'],
} as const;

type MountsParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const mountsOf = ({ mounts }: MountsParams): ReadonlyArray<SessionProjectMount> => {
  const [payments, ledger] = mounts;
  if (payments === undefined || ledger === undefined) {
    return mounts;
  }
  return [
    storyMountOf({ mount: payments, name: 'payments-api', branch: GUARD_BRANCH, index: 0 }),
    storyMountOf({
      mount: { ...payments, mountId: brandId<MountId>({ value: 'demo-board-mount-tests' }) },
      name: 'payments-api',
      branch: TESTS_BRANCH,
      index: 1,
    }),
    storyMountOf({ mount: ledger, name: 'ledger-core', branch: GUARD_BRANCH, index: 0 }),
  ];
};

export const installBoardStory = ({ store }: Params): void => {
  const at = nowIso({});
  const sessionId = BOARD_STORY_SESSION;
  const agent: Agent = {
    id: AGENT_ID,
    sessionId,
    ordinal: 1,
    name: 'Guard every consumer',
    kind: 'implementer',
    status: 'completed',
    startedAt: at,
    lastFinishedAt: at,
    lastViewedAt: at,
    providerOverride: 'anthropic',
    modelOverride: 'claude-opus-5-5',
  };
  const transcript: ReadonlyArray<TurnEvent> = [
    { kind: 'user_text', runId: RUN_ID, text: ORCHESTRATE_GOAL, at },
    {
      kind: 'assistant_text',
      runId: RUN_ID,
      delta:
        'Auto finished: every webhook consumer in payments-api and ledger-core skips an event id it already handled, and the replay test sends each event three times and sees one effect.',
      at,
    },
    { kind: 'done', runId: RUN_ID, at },
  ];
  const question: OpenQuestion = {
    id: brandId<OpenQuestionId>({ value: 'demo-board-story-question' }),
    sessionId,
    createdByAgentId: AGENT_ID,
    turnOrdinal: 1,
    text: BOARD_STORY_QUESTION.text,
    suggestedAnswers: [...BOARD_STORY_QUESTION.answers],
    recommendedAnswer: BOARD_STORY_QUESTION.answers[0],
    selectMode: 'one',
    isBlocking: true,
    userAnswer: null,
    status: 'open',
    createdAt: at,
  };
  store.setState((current) => ({
    sessions: current.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            goal: ORCHESTRATE_GOAL,
            state: { kind: 'idle', lastActivityAt: at },
            updatedAt: at,
          }
        : session,
    ),
    sessionGithub: {
      ...current.sessionGithub,
      ...(current.sessionGithub[sessionId] === undefined
        ? {}
        : { [sessionId]: { ...current.sessionGithub[sessionId], pr: null } }),
    },
    sessionProjectMounts: {
      ...current.sessionProjectMounts,
      [sessionId]: mountsOf({ mounts: current.sessionProjectMounts[sessionId] ?? [] }),
    },
    sessionPhaseRuns: { ...current.sessionPhaseRuns, [sessionId]: [agent] },
    selectedAgentId: { ...current.selectedAgentId, [sessionId]: AGENT_ID },
    transcripts: { ...current.transcripts, [AGENT_ID]: transcript },
    agentTurnState: { ...current.agentTurnState, [AGENT_ID]: { kind: 'idle', lastActivityAt: at } },
    sessionOpenQuestions: { ...current.sessionOpenQuestions, [sessionId]: [question] },
  }));
};
