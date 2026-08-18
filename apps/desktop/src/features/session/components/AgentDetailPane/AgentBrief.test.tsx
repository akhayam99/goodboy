// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';

const state = vi.hoisted(() => ({
  sessionPhaseRuns: {} as Record<string, ReadonlyArray<Agent>>,
  agentTurnState: {} as Record<string, unknown>,
  agentKindOverride: {} as Record<string, unknown>,
  sessionPlans: {} as Record<string, ReadonlyArray<unknown>>,
  selectAgent: async () => undefined,
}));

const transcriptItems = vi.hoisted(() => ({
  items: [] as ReadonlyArray<{ kind: string; text: string }>,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
}));

vi.mock('../../../../store/transcript', () => ({
  useTranscript: () => [],
}));

vi.mock('../../../chat/utils/transcript-items', () => ({
  reduceTranscript: () => transcriptItems.items,
}));

vi.mock('../../hooks/useAgentMetrics', () => ({
  useAgentMetrics: () => ({
    latestTelemetryByAgentId: new Map(),
    aggregatesByAgentId: new Map(),
    providerUsageByAgentId: new Map(),
    turnsByAgentId: new Map(),
  }),
}));

vi.mock('../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => [],
}));

vi.mock('./AgentFollowUps', () => ({
  AgentFollowUps: () => null,
}));

import { AgentBrief } from './AgentBrief';

const sessionId = 'session-1' as SessionId;
const agentId = 'agent-1' as AgentId;
const session = { id: sessionId, workflowRuns: [] } as unknown as Session;

const makeAgent = (over: Partial<Agent>): Agent => ({
  id: agentId,
  sessionId,
  ordinal: 0,
  name: 'Implement chat',
  status: 'completed',
  kind: 'implementer',
  ...over,
});

afterEach(cleanup);

beforeEach(() => {
  Object.assign(state, {
    sessionPhaseRuns: {},
    agentTurnState: {},
    agentKindOverride: {},
    sessionPlans: {},
  });
  transcriptItems.items = [];
});

describe('AgentBrief summary', () => {
  it('shows the recorded outcome when outputSummary has content', () => {
    const agent = makeAgent({ outputSummary: 'shipped the refactor' });

    render(<AgentBrief session={session} agent={agent} />);

    expect(screen.getByText('Outcome')).toBeDefined();
    expect(screen.getByText('shipped the refactor')).toBeDefined();
    expect(screen.queryByText('from the last reply')).toBeNull();
  });

  it('falls back to the last assistant reply when outputSummary is an empty string', () => {
    const agent = makeAgent({ outputSummary: '' });
    transcriptItems.items = [{ kind: 'assistant_text', text: 'here is the last reply' }];

    render(<AgentBrief session={session} agent={agent} />);

    expect(screen.getByText('Latest')).toBeDefined();
    expect(screen.getByText('here is the last reply')).toBeDefined();
    expect(screen.getByText('from the last reply')).toBeDefined();
  });

  it('falls back to the last assistant reply when outputSummary is absent', () => {
    const agent = makeAgent({ outputSummary: undefined });
    transcriptItems.items = [{ kind: 'assistant_text', text: 'still working from the transcript' }];

    render(<AgentBrief session={session} agent={agent} />);

    expect(screen.getByText('Latest')).toBeDefined();
    expect(screen.getByText('still working from the transcript')).toBeDefined();
  });
});
