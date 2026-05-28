// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

interface OpenQuestionsHook {
  questions: ReadonlyArray<unknown>;
  drafts: Record<string, unknown>;
  justAnswered: ReadonlyArray<unknown>;
  pendingUndo: unknown | null;
  loadQuestions: ReturnType<typeof vi.fn>;
  toggleSuggestion: ReturnType<typeof vi.fn>;
  setCustomAnswer: ReturnType<typeof vi.fn>;
  toggleCustomField: ReturnType<typeof vi.fn>;
  dismissQuestion: ReturnType<typeof vi.fn>;
  undoDismiss: ReturnType<typeof vi.fn>;
  submitClusterAnswers: ReturnType<typeof vi.fn>;
  clearJustAnswered: ReturnType<typeof vi.fn>;
}

const { hookState, storeState } = vi.hoisted(() => ({
  hookState: {
    questions: [],
    drafts: {},
    justAnswered: [],
    pendingUndo: null,
    loadQuestions: vi.fn(async () => undefined),
    toggleSuggestion: vi.fn(),
    setCustomAnswer: vi.fn(),
    toggleCustomField: vi.fn(),
    dismissQuestion: vi.fn(),
    undoDismiss: vi.fn(async () => undefined),
    submitClusterAnswers: vi.fn(async () => undefined),
    clearJustAnswered: vi.fn(),
  } as OpenQuestionsHook,
  storeState: {
    sessionPhaseRuns: {},
    sessions: [],
    phaseTemplates: {},
  } as Record<string, unknown>,
}));

vi.mock('./useOpenQuestions', () => ({
  useOpenQuestions: () => hookState,
}));

vi.mock('../../../../store/store', () => ({
  useAppStore: <T,>(selector: (s: typeof storeState) => T) => selector(storeState),
}));

vi.mock('./clusters', () => ({
  buildQuestionClusters: () => [],
}));

import { QuestionsTab } from './index';

beforeEach(() => {
  hookState.questions = [];
  hookState.pendingUndo = null;
  hookState.loadQuestions = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('QuestionsTab', () => {
  it('renders the empty state when there are no open questions', () => {
    render(<QuestionsTab sessionId={'s1' as never} onSubmit={vi.fn()} />);
    expect(screen.getByText(/no open questions/i)).toBeDefined();
    expect(hookState.loadQuestions).toHaveBeenCalledWith('s1');
  });
});
