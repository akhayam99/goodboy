// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  brandId,
  type OpenQuestion,
  type OpenQuestionId,
  type SearchHit,
  type SessionId,
} from '@goodboy/types';
import { TEST_NOW, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { questionPlace, sessionPlace } from '../../store/slices/navigation/place';
import type { Location } from '../../store/slices/navigation/types';
import { QUESTION_KIND } from '../actions/kinds/question';
import { WORKFLOW_RUN_KIND } from '../actions/kinds/workflowRun';
import type { ActionEnv } from '../actions/types';
import { useOpenAgentQuestion } from '../context/hooks/useOpenAgentQuestion';
import { focusQuestionAnswer } from '../context/focusQuestionAnswer';
import { openSearchHit } from '../search/openSearchHit';
import { attentionPlace } from './attentionPlace';
import { openQuestion } from './openQuestion';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const FIRST = brandId<OpenQuestionId>({ value: 'question-first' });
const SECOND = brandId<OpenQuestionId>({ value: 'question-second' });

let useAppStore: StoryStore;

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const questionOf = ({ id }: { readonly id: OpenQuestionId }): OpenQuestion =>
  JSON.parse(
    JSON.stringify({
      id,
      sessionId: SESSION,
      createdByAgentId: null,
      text: 'Which queue should the retries run on?',
      suggestedAnswers: ['The retry queue', 'The main queue'],
      isBlocking: false,
      userAnswer: null,
      status: 'open',
      createdAt: TEST_NOW,
    }),
  );

const seed = () => {
  useAppStore.setState({
    sessions: [aSession({ id: SESSION })],
    currentSessionId: SESSION,
    sessionPhaseRuns: { [SESSION]: [] },
    sessionOpenQuestions: { [SESSION]: [questionOf({ id: FIRST }), questionOf({ id: SECOND })] },
    setCurrentSession: async () => undefined,
  });
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION }) });
};

const state = () => useAppStore.getState();

const landedOn = ({ questionId }: { readonly questionId: OpenQuestionId }): void => {
  expect(state().activeLens[SESSION]).toBe('questions');
  expect(state().drawer).toEqual({
    kind: 'question',
    sessionId: SESSION,
    payload: { questionId },
  });
};

const searchHit = ({ questionId }: { readonly questionId: OpenQuestionId }): SearchHit => ({
  docId: `question:${questionId}`,
  kind: 'question',
  refId: questionId,
  workspaceId: null,
  sessionId: SESSION,
  sessionTitle: 'Guard the settlement batch',
  agentId: null,
  agentName: null,
  mountId: null,
  provider: null,
  container: null,
  status: null,
  ordinal: null,
  url: null,
  isArchived: false,
  occurredAt: TEST_NOW,
  title: [{ text: 'Which queue should the retries run on?', isMatch: false }],
  snippet: [],
});

type Door = {
  readonly name: string;
  readonly open: ({ questionId }: { readonly questionId: OpenQuestionId }) => Promise<void> | void;
};

const DOORS: ReadonlyArray<Door> = [
  {
    name: 'the Answer button of a run row',
    open: ({ questionId }) => openQuestion({ state: state(), sessionId: SESSION, questionId }),
  },
  {
    name: 'the palette and the object menu (Open question)',
    open: async ({ questionId }) => {
      const action = QUESTION_KIND.actions.find((candidate) => candidate.id === 'question.open');
      await action?.run({
        facts: { sessionId: SESSION, questionId, asker: null },
        env,
        choice: null,
      });
    },
  },
  {
    name: 'the run menu Answer',
    open: async ({ questionId }) => {
      const action = WORKFLOW_RUN_KIND.actions.find(
        (candidate) => candidate.id === 'workflowRun.answer',
      );
      const facts = JSON.parse(JSON.stringify({ sessionId: SESSION, openQuestionId: questionId }));
      await action?.run({ facts, env, choice: null });
    },
  },
  {
    name: 'a Needs you row, with or without an asker',
    open: ({ questionId }) => {
      const { result } = renderHook(() => useOpenAgentQuestion({ sessionId: SESSION }));
      result.current({ question: { id: questionId, createdByAgentId: null } });
    },
  },
  {
    name: 'a search hit on a question',
    open: async ({ questionId }) => {
      await openSearchHit({ hit: searchHit({ questionId }), query: 'queue' });
    },
  },
  {
    name: 'an Ask chip',
    open: ({ questionId }) => focusQuestionAnswer({ sessionId: SESSION, questionId }),
  },
  {
    name: 'the board, the banner and the Now chip',
    open: ({ questionId }) => {
      const place = attentionPlace({
        state: {
          ...state(),
          sessionOpenQuestions: { [SESSION]: [questionOf({ id: questionId })] },
        },
        sessionId: SESSION,
        reason: 'open-question',
      });
      state().navigate({ to: place });
    },
  },
];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seed();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('every door to a question', () => {
  for (const door of DOORS) {
    it(`lands on the question address from ${door.name}`, async () => {
      await door.open({ questionId: FIRST });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60);
      });

      landedOn({ questionId: FIRST });
    });
  }

  it('keeps the way back: Close returns to the page the door was pressed on', async () => {
    await act(async () => {
      openQuestion({ state: state(), sessionId: SESSION, questionId: FIRST });
    });
    landedOn({ questionId: FIRST });

    await act(async () => {
      state().closeQuestion();
    });

    expect(state().activeLens[SESSION] ?? null).toBeNull();
    expect(state().drawer).toBeNull();
  });

  it('replaces the entry when the next question opens, so Close skips the answered ones', async () => {
    await act(async () => {
      openQuestion({ state: state(), sessionId: SESSION, questionId: FIRST });
      openQuestion({ state: state(), sessionId: SESSION, questionId: SECOND });
    });
    landedOn({ questionId: SECOND });
    const entries = state().navigation[state().currentWorkspaceId ?? '']?.entries ?? [];

    await act(async () => {
      state().closeQuestion();
    });

    expect(entries).toHaveLength(2);
    expect(state().activeLens[SESSION] ?? null).toBeNull();
  });

  it('closes in place when the address was the only entry, as after a reload', async () => {
    await act(async () => {
      state().navigate({
        to: questionPlace({ sessionId: SESSION, questionId: FIRST }),
        mode: 'replace',
      });
    });
    landedOn({ questionId: FIRST });

    await act(async () => {
      state().closeQuestion();
    });

    expect(state().drawer).toBeNull();
    expect(state().activeLens[SESSION]).toBe('questions');
  });

  it('reopens the question a saved window addressed, by its id', async () => {
    const saved: Location = {
      workspaceId: state().currentWorkspaceId,
      place: questionPlace({ sessionId: SESSION, questionId: SECOND }),
      studio: null,
      focus: { drawer: null, scroll: {} },
    };

    await act(async () => {
      state().restoreLocation({ location: saved });
    });

    landedOn({ questionId: SECOND });
  });

  it('puts the question in the address the window saves', async () => {
    await act(async () => {
      openQuestion({ state: state(), sessionId: SESSION, questionId: FIRST });
    });

    const stack = state().navigation[state().currentWorkspaceId ?? ''];
    const top = stack?.entries[stack.index];

    expect(top?.place).toEqual(questionPlace({ sessionId: SESSION, questionId: FIRST }));
  });
});
