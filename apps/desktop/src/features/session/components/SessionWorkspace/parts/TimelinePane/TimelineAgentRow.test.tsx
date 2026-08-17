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
};

const entryFor = ({ outputSummary }: EntryParams): TimelineAgentEntry => {
  const agent: Agent = {
    id: typedString<AgentId>({ value: 'agent-1' }),
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'Draft the release notes',
    status: 'completed',
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
    hasDuration: true,
  };
};

type RenderParams = {
  readonly outputSummary?: string;
};

const renderRow = ({ outputSummary }: RenderParams) =>
  render(
    <TimelineAgentRow
      entry={entryFor({ outputSummary })}
      sessionId={SESSION_ID}
      estimatedCostUsd={null}
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

  it('claims no expanded state when there is nothing to reveal', () => {
    renderRow({});
    const toggle = screen.getByRole('button', { name: 'Draft the release notes' });

    expect(toggle.getAttribute('aria-expanded')).toBeNull();
    expect(toggle.hasAttribute('disabled')).toBe(true);
  });
});
