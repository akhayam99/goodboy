// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { hookState, appState } = vi.hoisted(() => ({
  hookState: {
    drafts: {} as Record<string, unknown>,
    justAnswered: [] as ReadonlyArray<unknown>,
    pendingUndo: null as unknown,
    toggleSuggestion: vi.fn(),
    setCustomAnswer: vi.fn(),
    toggleCustomField: vi.fn(),
    flashAnswered: vi.fn(),
    clearJustAnswered: vi.fn(),
    beginUndo: vi.fn(),
    clearUndo: vi.fn(),
  },
  appState: {
    sessionPhaseRuns: {} as Record<string, unknown>,
    sessions: [] as ReadonlyArray<unknown>,
    phaseTemplates: {} as Record<string, unknown>,
    loadSessionOpenQuestions: vi.fn(async () => undefined),
    answerOpenQuestions: vi.fn(async () => undefined),
    dismissOpenQuestion: vi.fn(async () => undefined),
    restoreDismissedOpenQuestion: vi.fn(async () => undefined),
  },
}));

const openQuestions: { current: ReadonlyArray<unknown> } = { current: [] };

vi.mock('./useOpenQuestions', () => ({
  useOpenQuestions: () => hookState,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof appState) => T) => selector(appState),
  useSessionOpenQuestions: () => openQuestions.current,
}));

vi.mock('./clusters', () => ({
  buildQuestionClusters: () => [],
}));

import { QuestionsTab } from './index';

beforeEach(() => {
  openQuestions.current = [];
  appState.loadSessionOpenQuestions = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('QuestionsTab', () => {
  it('renders the empty state when there are no open questions', () => {
    render(<QuestionsTab sessionId={'s1' as never} />);
    expect(screen.getByText(/no open questions/i)).toBeDefined();
    expect(appState.loadSessionOpenQuestions).toHaveBeenCalledWith('s1');
  });
});
