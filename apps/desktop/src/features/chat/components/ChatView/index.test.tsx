// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
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
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionLoading: () => ({ transcript: false }),
  useTranscript: () => [],
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
});
afterEach(cleanup);

describe('ChatView', () => {
  it('renders without throwing on an empty session', () => {
    const { container } = render(<ChatView session={session} />);
    expect(container.firstChild).not.toBeNull();
  });
});
