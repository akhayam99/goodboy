// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type ProjectId,
  type PullRequestState,
  type SessionId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { buildAskPack, type AskPackComment, type AskPackInput } from './buildAskPack';
import { askDigestOf, collectAskPackInput } from './collectAskPackInput';
import { RESOLVE_WORD_LABEL } from '../../resolve/commentProjection';
import { askSuggestions } from './askRightNow';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const PROJECT = brandId<ProjectId>({ value: 'project-payments-api' });
const AT = brandId<IsoDateTime>({ value: '2026-10-06T14:56:25Z' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const pullRequest: PullRequestState = {
  number: 9914,
  title: 'Encode signup intents as opaque aliases',
  url: 'https://github.com/harborline/payments-api/pull/9914',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'harborline/opaque-aliases',
  isDraft: false,
  reviewDecision: 'review_required',
  body: '',
  updatedAt: AT,
};

const openQuestion: OpenQuestion = {
  id: brandId<OpenQuestionId>({ value: 'q-1' }),
  sessionId: SESSION,
  createdByAgentId: brandId<AgentId>({ value: 'agent-planner' }),
  text: 'Stop after 5 attempts, or keep backing off?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: AT,
};

const suggestionsAndPack = () => {
  const state = useAppStore.getState();
  const digest = askDigestOf({ state, sessionId: SESSION, now: Date.parse(AT) });
  const pack = buildAskPack(collectAskPackInput({ state, sessionId: SESSION, rightNow: [] }));
  return { suggestions: askSuggestions(digest), text: pack.text };
};

describe('the Ask suggestions only offer what the pack can answer', () => {
  it('answers the always-on suggestion from the goal the pack carries', () => {
    useAppStore.setState({ sessions: [aSession({ id: SESSION, goal: 'Opaque signup aliases' })] });

    const { suggestions, text } = suggestionsAndPack();

    expect(suggestions).toEqual(['Where does this session stand?']);
    expect(text).toContain('Opaque signup aliases');
  });

  it('offers the failed-agent question only when the pack lists that agent as failed', () => {
    useAppStore.setState({
      sessions: [aSession({ id: SESSION, goal: 'Opaque signup aliases' })],
      sessionPhaseRuns: {
        [SESSION]: [
          anAgent({
            id: brandId<AgentId>({ value: 'agent-tester' }),
            sessionId: SESSION,
            name: 'Tester',
            status: 'failed',
          }),
        ],
      },
    });

    const { suggestions, text } = suggestionsAndPack();

    expect(suggestions).toContain('Why did Tester fail?');
    expect(text).toContain('Tester · failed');
  });

  it('offers the merge question only when the pack carries that pull request', () => {
    useAppStore.setState({
      sessions: [aSession({ id: SESSION, goal: 'Opaque signup aliases' })],
      sessionProjectPrs: { [SESSION]: { [PROJECT]: [pullRequest] } },
    });

    const { suggestions, text } = suggestionsAndPack();

    expect(suggestions).toContain('Is #9914 ready to merge?');
    expect(text).toContain('[PR] #9914 open');
  });

  it('offers What needs me only when the pack lists the open question', () => {
    useAppStore.setState({
      sessions: [aSession({ id: SESSION, goal: 'Opaque signup aliases' })],
      sessionOpenQuestions: { [SESSION]: [openQuestion] },
    });

    const { suggestions, text } = suggestionsAndPack();

    expect(suggestions).toContain('What needs me?');
    expect(text).toContain('## Open questions');
    expect(text).toContain('Stop after 5 attempts');
  });
});

type CommentParams = {
  readonly word: AskPackComment['word'];
};

const comment = ({ word }: CommentParams): AskPackComment => ({
  threadId: `thread-${word}`,
  word,
  author: 'Northwind',
  location: 'retry.ts:12',
  body: 'Keep the retry count.',
});

type PackInputParams = {
  readonly comments: ReadonlyArray<AskPackComment>;
};

const packInput = ({ comments }: PackInputParams): AskPackInput => ({
  title: 'Fix webhook retries',
  rightNow: [],
  live: { calls: [], checks: [], worktrees: [], scripts: [] },
  goal: 'Retry a failed delivery.',
  decisions: '',
  summary: '',
  agents: [],
  questions: [],
  runs: [],
  comments,
  branches: [],
  pullRequest: null,
  artifacts: [],
  events: [],
});

describe('the comment suggestions', () => {
  it('lists every comment a suggestion mentions in the pack', () => {
    const words = ['question', 'to_review', 'couldnt_fix'] as const;
    const suggestions = askSuggestions({
      commentWords: words,
      failedAgents: [],
      openQuestionsFrom: [],
      prNumber: null,
    });
    const text = buildAskPack(packInput({ comments: words.map((word) => comment({ word })) })).text;

    expect(suggestions).toContain('What needs me?');
    expect(suggestions).toContain('Why did a comment fix fail?');
    words.forEach((word) => {
      expect(text).toContain(`${RESOLVE_WORD_LABEL[word]} · Northwind`);
    });
  });
});
