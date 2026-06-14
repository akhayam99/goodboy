// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state, openQuestions, answeredQuestions } = vi.hoisted(() => ({
  openQuestions: { current: [] as ReadonlyArray<unknown> },
  answeredQuestions: { current: [] as ReadonlyArray<unknown> },
  state: {
    selectedAgentId: {} as Record<string, string | null>,
    transcripts: {} as Record<string, unknown>,
    selectAgent: vi.fn(async () => undefined),
    markAgentViewed: vi.fn(async () => undefined),
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    authResults: {} as Record<string, unknown>,
    refreshProviders: vi.fn(async () => undefined),
    settings: {} as Record<string, string>,
    agentTurnState: {} as Record<string, unknown>,
    agentKindOverride: {} as Record<string, string>,
    sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
    sessionMergeConflicts: {} as Record<string, ReadonlyArray<unknown>>,
    resolveMergeConflicts: vi.fn(async () => undefined),
    loadSessionOpenQuestions: vi.fn(async () => undefined),
    loadSessionAnsweredQuestions: vi.fn(async () => undefined),
    openQuestionScrollTarget: null as { agentId: string; questionId: string } | null,
    clearOpenQuestionScroll: vi.fn(() => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionLoading: () => ({ transcript: false }),
  useSessionOpenQuestions: () => openQuestions.current,
  useSessionAnsweredQuestions: () => answeredQuestions.current,
  useTranscript: () => [],
}));

vi.mock('./OpenQuestionInlineCard', () => ({
  OpenQuestionInlineCard: () => null,
}));

vi.mock('../../utils/transcript-items', () => ({
  detectParallelRunIds: () => [],
  filterEventsByRunId: () => [],
  reduceTranscript: () => [],
}));

vi.mock('../TranscriptCards', () => ({
  TranscriptCard: () => null,
}));

vi.mock('../AuthRequiredCallout', () => ({
  AuthRequiredCallout: () => null,
}));

vi.mock('../ChatBreadcrumb', () => ({
  ChatBreadcrumb: () => null,
}));

vi.mock('../ChatInput', () => ({
  ChatInput: () => null,
}));

vi.mock('../../../../features/permissions/components/MergeDialog', () => ({
  MergeDialog: () => null,
}));

vi.mock('../../../../features/permissions/components/DiffViewerDialog', () => ({
  DiffViewerDialog: () => null,
}));

vi.mock('../../../../features/worktree/worktree', () => ({
  worktreeDiff: vi.fn(async () => ''),
}));

vi.mock('../../../../assets/agents/debugger.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/docs.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/goodboy.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/implementer.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/planner.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/reviewer.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/scout.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/tester.png', () => ({ default: '' }));

import { ChatView } from './index';

const session: Session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'g',
  workflowRuns: [],
  state: { kind: 'idle' },
  providerPreference: { defaultProvider: 'anthropic' },
} as unknown as Session;

beforeEach(() => {
  state.selectedAgentId = {};
  state.transcripts = {};
  state.sessionPhaseRuns = {};
  state.sessionWorktrees = {};
  state.authResults = {};
  state.settings = {};
  state.agentTurnState = {};
  state.agentKindOverride = {};
  state.sessionWorkflows = {};
  state.sessionMergeConflicts = {};
  state.openQuestionScrollTarget = null;
  state.loadSessionOpenQuestions.mockClear();
  state.loadSessionAnsweredQuestions.mockClear();
  state.clearOpenQuestionScroll.mockClear();
  openQuestions.current = [];
  answeredQuestions.current = [];
  (Element.prototype as unknown as { scrollTo: unknown }).scrollTo = vi.fn();
  (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe('ChatView', () => {
  it('renders without throwing on an empty session', () => {
    const { container } = render(<ChatView session={session} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('loads open and answered questions on mount', () => {
    render(<ChatView session={session} />);
    expect(state.loadSessionOpenQuestions).toHaveBeenCalledWith('sess-1');
    expect(state.loadSessionAnsweredQuestions).toHaveBeenCalledWith('sess-1');
  });

  it('consumes a matching scroll target with no painted anchor', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    state.openQuestionScrollTarget = { agentId: 'agent-1', questionId: 'oq-1' };
    render(<ChatView session={session} />);
    expect(state.clearOpenQuestionScroll).toHaveBeenCalled();
  });
});
