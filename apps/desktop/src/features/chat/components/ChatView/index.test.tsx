// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state, openQuestions, answeredQuestions, transcriptItems } = vi.hoisted(() => ({
  openQuestions: { current: [] as ReadonlyArray<unknown> },
  answeredQuestions: { current: [] as ReadonlyArray<unknown> },
  transcriptItems: { current: [] as ReadonlyArray<unknown> },
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

vi.mock('./OpenQuestionCluster', () => ({
  OpenQuestionCluster: ({ questions }: { questions: ReadonlyArray<{ id: string }> }) => (
    <div data-testid="cluster">{questions.map((q) => q.id).join(',')}</div>
  ),
}));

vi.mock('../../utils/transcript-items', () => ({
  detectParallelRunIds: () => [],
  filterEventsByRunId: () => [],
  reduceTranscript: () => transcriptItems.current,
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
  transcriptItems.current = [];
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

  it('clusters same-turn questions for the selected agent, sorted by createdAt', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    transcriptItems.current = [{ kind: 'user_text', key: 'u0', at: '2026-06-13T00:00:00.000Z' }];
    openQuestions.current = [
      {
        id: 'q-late',
        createdByAgentId: 'agent-1',
        turnOrdinal: 0,
        createdAt: '2026-06-13T00:00:02.000Z',
      },
      {
        id: 'q-early',
        createdByAgentId: 'agent-1',
        turnOrdinal: 0,
        createdAt: '2026-06-13T00:00:01.000Z',
      },
      {
        id: 'q-other-agent',
        createdByAgentId: 'agent-2',
        turnOrdinal: 0,
        createdAt: '2026-06-13T00:00:00.000Z',
      },
      {
        id: 'q-no-ordinal',
        createdByAgentId: 'agent-1',
        turnOrdinal: null,
        createdAt: '2026-06-13T00:00:00.000Z',
      },
    ];

    render(<ChatView session={session} />);

    const clusters = screen.getAllByTestId('cluster');
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.textContent).toBe('q-early,q-late');
  });

  it('splits questions from different turns into separate clusters', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    transcriptItems.current = [{ kind: 'user_text', key: 'u0', at: '2026-06-13T00:00:00.000Z' }];
    openQuestions.current = [
      {
        id: 'q-turn0',
        createdByAgentId: 'agent-1',
        turnOrdinal: 0,
        createdAt: '2026-06-13T00:00:00.000Z',
      },
      {
        id: 'q-turn1',
        createdByAgentId: 'agent-1',
        turnOrdinal: 1,
        createdAt: '2026-06-13T00:00:01.000Z',
      },
    ];

    render(<ChatView session={session} />);

    const clusters = screen.getAllByTestId('cluster');
    expect(clusters.map((c) => c.textContent)).toEqual(['q-turn0', 'q-turn1']);
  });
});
