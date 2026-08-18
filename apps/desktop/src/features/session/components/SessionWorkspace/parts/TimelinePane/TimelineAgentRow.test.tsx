// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, OpenQuestion, SessionId } from '@goodboy/types';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';

type Store = {
  readonly selectAgent: ReturnType<typeof vi.fn>;
  readonly setActiveLens: ReturnType<typeof vi.fn>;
};

const { store } = vi.hoisted(() => ({
  store: {
    selectAgent: vi.fn(),
    setActiveLens: vi.fn(),
  } as Store,
}));

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  agentHasUnread: () => false,
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
  readonly status?: Agent['status'];
  readonly outputSummary?: string;
  readonly stepLabel?: string | null;
  readonly openQuestions?: ReadonlyArray<OpenQuestion>;
};

const questionOf = (): OpenQuestion =>
  ({
    id: 'question-1',
    sessionId: SESSION_ID,
    text: 'Which parser should own the fallback?',
    status: 'open',
  }) as unknown as OpenQuestion;

const entryOf = ({
  status = 'completed',
  outputSummary,
  stepLabel = null,
  openQuestions = [],
}: EntryParams = {}): TimelineAgentEntry => ({
  kind: 'agent',
  id: 'agent:one',
  at: '2026-08-17T09:00:00Z',
  ordinal: 1,
  agent: {
    id: typedString<AgentId>({ value: 'one' }),
    sessionId: SESSION_ID,
    ordinal: 1,
    name: 'Implement the parser',
    status,
    startedAt: typedString<IsoDateTime>({ value: '2026-08-17T09:00:00Z' }),
    completedAt: typedString<IsoDateTime>({ value: '2026-08-17T09:05:00Z' }),
    ...(outputSummary != null ? { outputSummary } : {}),
  },
  agentKind: 'implementer',
  stepLabel,
  openQuestions,
  terminalQuestions: [],
  children: [],
  answers: [],
  hasDuration: true,
});

type RenderParams = {
  readonly entry?: TimelineAgentEntry;
  readonly isExpanded?: boolean;
  readonly onToggle?: () => void;
};

const renderRow = ({
  entry = entryOf(),
  isExpanded = false,
  onToggle = vi.fn(),
}: RenderParams = {}) =>
  render(
    <TimelineAgentRow
      entry={entry}
      sessionId={SESSION_ID}
      timeLabel="09:00"
      depth={1}
      identity={null}
      diffComment={null}
      isExpanded={isExpanded}
      onToggle={onToggle}
      onSeen={vi.fn()}
    />,
  );

beforeEach(() => {
  store.selectAgent.mockClear();
  store.setActiveLens.mockClear();
});

afterEach(cleanup);

describe('TimelineAgentRow', () => {
  it('keeps expanding and navigating as two separate targets', () => {
    const onToggle = vi.fn();
    renderRow({ entry: entryOf({ outputSummary: 'Parser landed.' }), onToggle });

    const disclosure = screen.getByRole('button', { name: 'Expand Implement the parser' });
    fireEvent.click(disclosure);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(store.selectAgent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(store.selectAgent).toHaveBeenCalledTimes(1);
  });

  it('offers no disclosure when the row has nothing to disclose', () => {
    renderRow();

    expect(screen.queryByRole('button', { name: /Expand/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open chat' })).toBeDefined();
  });

  it('puts the disclosed outcome inside the row surface rather than beside it', () => {
    renderRow({ entry: entryOf({ outputSummary: 'Parser landed.' }), isExpanded: true });

    const surface = screen.getByRole('button', { name: 'Collapse Implement the parser' })
      .parentElement?.parentElement;

    expect(surface?.className).toContain('bg-muted/40');
    expect(surface?.contains(screen.getByText('Parser landed.'))).toBe(true);
  });

  it('carries no cost or step count in the row', () => {
    renderRow({ entry: entryOf({ stepLabel: '3.1' }) });

    expect(screen.getByText('3.1')).toBeDefined();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('highlights a row that needs the user with a tint and a lit marker, never motion', () => {
    const { container } = renderRow({ entry: entryOf({ openQuestions: [questionOf()] }) });

    const surface = screen.getByRole('button', { name: 'Expand Implement the parser' })
      .parentElement?.parentElement;
    expect(surface?.className).toContain('bg-warning');
    expect(screen.getByLabelText('Waiting for you')).toBeDefined();

    for (const element of container.querySelectorAll('*')) {
      expect(element.className.toString()).not.toMatch(
        /animate-|border-pulse|attention-ring|pulsing/,
      );
    }
  });

  it('offers the action that unblocks the row, in the row', () => {
    renderRow({ entry: entryOf({ openQuestions: [questionOf()] }) });

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(store.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'questions');
  });

  it('indents by one small step per level rather than compounding', () => {
    const { container } = renderRow();
    const indented = container.querySelector('.pl-4');

    expect(indented).not.toBeNull();
    expect(container.querySelector('.pl-16')).toBeNull();
  });
});
