// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';

type Store = {
  readonly selectAgent: ReturnType<typeof vi.fn>;
};

const { store } = vi.hoisted(() => ({
  store: { selectAgent: vi.fn() } as Store,
}));

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

import { TimelineAgentRow } from './TimelineAgentRow';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'session-1' });

type EntryParams = {
  readonly outputSummary?: string;
  readonly status?: Agent['status'];
};

const entryFor = ({ outputSummary, status = 'completed' }: EntryParams): TimelineAgentEntry => {
  const agent: Agent = {
    id: typedString<AgentId>({ value: 'agent-1' }),
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'Draft the release notes',
    status,
    startedAt: typedString<IsoDateTime>({ value: '2026-08-17T09:00:00Z' }),
    completedAt: typedString<IsoDateTime>({ value: '2026-08-17T09:30:00Z' }),
    ...(outputSummary != null ? { outputSummary } : {}),
  };
  return {
    kind: 'agent',
    id: `agent:${agent.id}`,
    at: '2026-08-17T09:00:00Z',
    agent,
    agentKind: 'planner',
    depth: 0,
    clusterIndex: null,
    terminalQuestions: [],
    answers: [],
    hasDuration: true,
  };
};

type RenderParams = {
  readonly outputSummary?: string;
  readonly status?: Agent['status'];
};

const renderRow = ({ outputSummary, status }: RenderParams) =>
  render(
    <TimelineAgentRow
      entry={entryFor({ outputSummary, status })}
      sessionId={SESSION_ID}
      timeLabel="09:00"
    />,
  );

beforeEach(() => {
  store.selectAgent.mockClear();
});

afterEach(cleanup);

describe('TimelineAgentRow', () => {
  it('names the expand action and reports its state', () => {
    renderRow({ outputSummary: 'Shipped the notes' });
    const toggle = screen.getByRole('button', { name: 'Expand Draft the release notes' });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Collapse Draft the release notes' })).toBeDefined();
    expect(screen.getByText('Shipped the notes')).toBeDefined();
  });

  it('navigates on whole-row click to the agent chat', () => {
    renderRow({});
    fireEvent.click(screen.getByRole('button', { name: /open chat for Draft the release notes/i }));
    expect(store.selectAgent).toHaveBeenCalledWith(SESSION_ID, 'agent-1');
  });

  it('shows a red marker for a failed agent so status carries by shape too', () => {
    renderRow({ status: 'failed' });
    expect(screen.getByLabelText('Failed')).toBeDefined();
  });

  it('shows a running-tone pulsing marker for a running agent', () => {
    renderRow({ status: 'running' });
    expect(screen.getByLabelText('Running')).toBeDefined();
  });
});
