// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import type { ReactNode } from 'react';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TranscriptRow } from '../../utils/cluster-operations';

vi.mock('../TranscriptCards', () => ({
  TranscriptCard: ({
    item,
    previousRunId,
  }: {
    item: TranscriptItem;
    previousRunId?: string | null;
  }) => (
    <div data-testid="card" data-previous-run={previousRunId ?? ''}>
      {item.kind}
    </div>
  ),
}));

vi.mock('../OperationsCluster', () => ({
  OperationsCluster: () => <div data-testid="ops" />,
}));

vi.mock('../ThinkingIndicator', () => ({
  ThinkingIndicator: () => <div data-testid="thinking" />,
}));

vi.mock('./OpenQuestionCluster', () => ({
  OpenQuestionCluster: ({ questions }: { questions: ReadonlyArray<{ id: string }> }) => (
    <div data-testid="oq">{questions.map((question) => question.id).join(',')}</div>
  ),
}));

import { formatDayMonth } from '../../../../shared/utils/time/formatDayMonth';
import { TranscriptRows } from './TranscriptRows';

const retryErrorSpy = vi.fn();

const itemRow = (item: TranscriptItem): TranscriptRow => ({ kind: 'item', key: item.key, item });

const userText = (key: string, at: Date): TranscriptItem => ({
  kind: 'user_text',
  key,
  text: 'hello',
  at: at.toISOString() as IsoDateTime,
});

const renderRows = (
  rows: ReadonlyArray<TranscriptRow>,
  oqByTurnOrdinal: ReadonlyMap<number | null, ReadonlyArray<never>> = new Map(),
  mountSuggestionsByRun?: ReadonlyMap<ProviderRunId, ReactNode>,
  newFromKey: string | null = null,
) =>
  render(
    <ul>
      <TranscriptRows
        rows={rows}
        oqByTurnOrdinal={oqByTurnOrdinal}
        sessionId={'s1' as SessionId}
        selectedAgentId={'a1' as AgentId}
        workingDir={null}
        onRefreshAuth={() => undefined}
        onOpenDiff={() => undefined}
        isThinking={false}
        thinkingPhrase="Thinking"
        onRetryRun={retryErrorSpy}
        retryingRunId={null}
        mountSuggestionsByRun={mountSuggestionsByRun}
        newFromKey={newFromKey}
      />
    </ul>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const RUN_ID = 'run-1' as ProviderRunId;

const transition = (key: string): TranscriptItem => ({
  kind: 'step_transition',
  key,
  fromStep: { ordinal: 0, name: 'Trace the rounding' },
  toStep: { ordinal: 1, name: 'Round once per batch' },
  carryForwardContext: '',
  at: new Date(2026, 4, 15, 9, 0, 0).toISOString(),
});

const handoff = (key: string, at: Date): TranscriptItem => ({
  kind: 'handoff',
  key,
  handoffId: 'a1' as AgentId,
  text: 'Round once per batch.',
  at: at.toISOString() as IsoDateTime,
});

const decision = (key: string): TranscriptItem => ({
  kind: 'orchestrator_decision',
  key,
  action: 'next',
  reason: 'because',
  at: new Date(2026, 4, 15, 9, 1, 0).toISOString() as IsoDateTime,
});

describe('TranscriptRows', () => {
  it('renders adjacent workflow rows as one continuous rail group', () => {
    const { container } = renderRows([
      itemRow(transition('k1')),
      itemRow(decision('d1')),
      itemRow({ kind: 'assistant_text', key: 'a1', text: 'hi' }),
    ]);
    const rows = container.querySelectorAll('[data-turn] > ul > li');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.className).toContain('flex flex-col');
    expect(rows[0]!.querySelectorAll('[data-testid="card"]')).toHaveLength(2);
  });

  it('breaks the rail group when a non-workflow row interrupts it', () => {
    const { container } = renderRows([
      itemRow(transition('k1')),
      itemRow({ kind: 'assistant_text', key: 'a1', text: 'hi' }),
      itemRow(decision('d1')),
    ]);
    expect(container.querySelectorAll('[data-turn] > ul > li')).toHaveLength(3);
  });

  it('counts the handoff as the first turn, with its day chip and the questions it raised', () => {
    const oqByTurnOrdinal = new Map([[1, [{ id: 'first-turn' }]]]) as unknown as ReadonlyMap<
      number | null,
      ReadonlyArray<never>
    >;
    const { container } = renderRows(
      [
        itemRow(handoff('h1', new Date(2026, 4, 15, 9, 0, 0))),
        itemRow({ kind: 'assistant_text', key: 'a1', text: 'which one?' }),
        itemRow(userText('u2', new Date(2026, 4, 15, 9, 5, 0))),
      ],
      oqByTurnOrdinal,
    );
    const rows = [...container.querySelectorAll('[data-turn] > ul > li')];
    expect(rows).toHaveLength(5);
    expect(rows[3]!.querySelector('[data-testid="oq"]')?.textContent).toBe('first-turn');
  });

  it('renders no separator for a run completion', () => {
    const { container } = renderRows([
      itemRow(userText('u1', new Date(2026, 4, 15, 9, 0, 0))),
      itemRow({ kind: 'done', key: 'done-1' }),
    ]);
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);
  });

  it('emits no row at all for a run completion', () => {
    const { container } = renderRows([
      itemRow(userText('u1', new Date(2026, 4, 15, 9, 0, 0))),
      itemRow({ kind: 'done', key: 'done-1' }),
      itemRow({ kind: 'done', key: 'done-2' }),
    ]);
    expect(screen.getAllByTestId('card')).toHaveLength(1);
    expect(container.querySelectorAll('[data-turn] > ul > li')).toHaveLength(2);
  });

  it('keeps the day boundary chip across a run completion', () => {
    const { container } = renderRows([
      itemRow(userText('u1', new Date(2026, 4, 15, 9, 0, 0))),
      itemRow({ kind: 'done', key: 'done-1' }),
      itemRow(userText('u2', new Date(2026, 4, 16, 9, 0, 0))),
    ]);
    expect(screen.getAllByTestId('card')).toHaveLength(2);
    expect(container.querySelectorAll('[data-turn] > ul > li')).toHaveLength(4);
  });

  it('drops the day chip when the transcript starts today', () => {
    renderRows([itemRow(userText('u1', new Date()))]);
    expect(screen.queryByTestId('transcript-day')).toBeNull();
  });

  it('keeps the day chip when the transcript started on an earlier day', () => {
    renderRows([itemRow(userText('u1', new Date(2026, 4, 15, 9, 0, 0)))]);
    expect(screen.getAllByTestId('transcript-day')).toHaveLength(1);
  });

  it('aligns the day divider to the start like the rows', () => {
    renderRows([itemRow(userText('u1', new Date(2026, 4, 15, 9, 0, 0)))]);
    expect(screen.getByTestId('transcript-day').getAttribute('data-align')).toBe('start');
  });

  it('marks the move into today after an earlier day with a plain month and day', () => {
    const now = new Date();
    renderRows([
      itemRow(userText('u1', new Date(Date.now() - 86_400_000))),
      itemRow(userText('u2', now)),
    ]);
    const days = screen.getAllByTestId('transcript-day');
    expect(days).toHaveLength(2);
    expect(days[1]?.textContent).toBe(formatDayMonth({ at: now.toISOString() }));
    expect(days[1]?.querySelector('.rounded-full')).toBeNull();
  });

  it('renders future and null ordinal question buckets at the transcript tail', () => {
    const oqByTurnOrdinal = new Map([
      [4, [{ id: 'future' }]],
      [null, [{ id: 'legacy' }]],
    ]) as unknown as ReadonlyMap<number | null, ReadonlyArray<never>>;

    renderRows([itemRow(userText('u1', new Date(2026, 4, 15, 9, 0, 0)))], oqByTurnOrdinal);

    expect(screen.getAllByTestId('oq').map((question) => question.textContent)).toEqual([
      'future',
      'legacy',
    ]);
  });

  it('seats a mount suggestion right after the turn that asked for it', () => {
    const { container } = renderRows(
      [
        itemRow({ kind: 'assistant_text', key: 'a0', text: 'looking' }),
        itemRow({ kind: 'error', key: 'e1', message: 'Added later: web', runId: RUN_ID }),
        itemRow({ kind: 'assistant_text', key: 'a1', text: 'carrying on' }),
      ],
      new Map(),
      new Map([[RUN_ID, <div data-testid="mount-suggestion">web</div>]]),
    );
    const rows = [...container.querySelectorAll('[data-turn] > ul > li')];
    const suggestionIndex = rows.findIndex(
      (row) => row.querySelector('[data-testid="mount-suggestion"]') !== null,
    );
    expect(suggestionIndex).toBe(2);
    expect(rows).toHaveLength(4);
  });

  it('seats a mount suggestion at the tail when its turn left no anchor row', () => {
    const { container } = renderRows(
      [itemRow({ kind: 'assistant_text', key: 'a1', text: 'carrying on' })],
      new Map(),
      new Map([[RUN_ID, <div data-testid="mount-suggestion">web</div>]]),
    );
    const rows = [...container.querySelectorAll('[data-turn] > ul > li')];
    expect(rows).toHaveLength(2);
    expect(rows[1]!.querySelector('[data-testid="mount-suggestion"]')).not.toBeNull();
  });

  it('renders one card per proposal even when the same turn errors twice', () => {
    renderRows(
      [
        itemRow({ kind: 'error', key: 'e1', message: 'first', runId: RUN_ID }),
        itemRow({ kind: 'error', key: 'e2', message: 'second', runId: RUN_ID }),
      ],
      new Map(),
      new Map([[RUN_ID, <div data-testid="mount-suggestion">web</div>]]),
    );
    expect(screen.getAllByTestId('mount-suggestion')).toHaveLength(1);
  });

  it('gives each row kind its own intrinsic size estimate', () => {
    const { container } = renderRows([
      itemRow(userText('u1', new Date())),
      itemRow({ kind: 'assistant_text', key: 'a1', text: 'word '.repeat(300) }),
    ]);
    const sizes = [...container.querySelectorAll<HTMLElement>('[data-turn] > ul > li')].map(
      (li) => li.style.containIntrinsicSize,
    );
    expect(sizes).toHaveLength(2);
    expect(sizes[0]).not.toBe(sizes[1]);
    expect(sizes.every((size) => size.startsWith('auto '))).toBe(true);
  });
});

describe('the New divider', () => {
  const rows = [
    itemRow(userText('user-1', new Date(2026, 4, 15, 9, 0, 0))),
    itemRow({ kind: 'assistant_text', key: 'reply-1', text: 'Seen reply.' }),
    itemRow(userText('user-2', new Date(2026, 4, 15, 10, 0, 0))),
    itemRow({ kind: 'assistant_text', key: 'reply-2', text: 'Unseen reply.' }),
  ];

  it('draws one hairline with the word New before the first unseen row', () => {
    renderRows(rows, new Map(), undefined, 'user-2');

    const divider = screen.getByTestId('transcript-new');
    expect(divider.textContent).toBe('New');
    expect(divider.querySelector('[role="separator"]')).not.toBeNull();
    expect(divider.previousElementSibling).toBeNull();
    expect(divider.nextElementSibling?.textContent).toBe('user_text');
    expect(
      divider
        .closest('[data-turn]')
        ?.previousElementSibling?.textContent?.endsWith('assistant_text'),
    ).toBe(true);
  });

  it('draws nothing without a boundary, or when the boundary names no row', () => {
    const first = renderRows(rows);
    expect(screen.queryByTestId('transcript-new')).toBeNull();
    first.unmount();

    renderRows(rows, new Map(), undefined, 'user-gone');
    expect(screen.queryByTestId('transcript-new')).toBeNull();
  });
});

describe('the transcript rhythm', () => {
  const twoTurns = [
    itemRow(userText('user-1', new Date(2026, 4, 15, 9, 0, 0))),
    itemRow({ kind: 'assistant_text', key: 'reply-1', text: 'First reply.' }),
    itemRow({ kind: 'assistant_text', key: 'reply-2', text: 'Second reply.' }),
    itemRow(userText('user-2', new Date(2026, 4, 15, 10, 0, 0))),
    itemRow({ kind: 'assistant_text', key: 'reply-3', text: 'Third reply.' }),
  ];

  it('opens a turn at each message of the person and keeps its blocks in one list', () => {
    const { container } = renderRows(twoTurns);

    const turns = [...container.querySelectorAll('[data-turn]')];
    expect(turns).toHaveLength(2);
    expect(turns.map((turn) => turn.querySelectorAll(':scope > ul > li').length)).toEqual([4, 2]);
  });

  it('leaves the turn gap to the list around and the block gap to one list inside each turn', () => {
    const { container } = renderRows(twoTurns);

    for (const turn of container.querySelectorAll('[data-turn]')) {
      expect(turn.children).toHaveLength(1);
      expect(turn.firstElementChild?.tagName).toBe('UL');
    }
  });

  it('hands each turn footer the run of the footer before it, so the speaker is named once', () => {
    const usage = (key: string, runId: string): TranscriptItem => ({
      kind: 'usage',
      key,
      runId: brandId<ProviderRunId>({ value: runId }),
      at: brandId<IsoDateTime>({ value: new Date(2026, 4, 15, 9, 1, 0).toISOString() }),
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        cachedInputTokens: 0,
        estimatedCostUsd: 0,
      },
    });
    const { container } = renderRows([
      itemRow(userText('user-1', new Date(2026, 4, 15, 9, 0, 0))),
      itemRow(usage('usage-1', 'run-1')),
      itemRow(userText('user-2', new Date(2026, 4, 15, 9, 2, 0))),
      itemRow(usage('usage-2', 'run-2')),
    ]);

    const previous = [...container.querySelectorAll('[data-testid="card"]')]
      .filter((card) => card.textContent === 'usage')
      .map((card) => card.getAttribute('data-previous-run'));
    expect(previous).toEqual(['', 'run-1']);
  });

  it('puts the thinking tail in the last turn, not in a turn of its own', () => {
    const { container } = render(
      <ul>
        <TranscriptRows
          rows={twoTurns}
          oqByTurnOrdinal={new Map()}
          sessionId={brandId<SessionId>({ value: 's1' })}
          selectedAgentId={brandId<AgentId>({ value: 'a1' })}
          workingDir={null}
          onRefreshAuth={() => undefined}
          onOpenDiff={() => undefined}
          isThinking
          thinkingPhrase="Thinking"
          onRetryRun={retryErrorSpy}
          retryingRunId={null}
        />
      </ul>,
    );

    const turns = container.querySelectorAll('[data-turn]');
    expect(turns).toHaveLength(2);
    expect(turns[1]?.querySelector('[data-testid="thinking"]')).not.toBeNull();
  });

  it('starts a turn with its day chip, so the chip sits under the turn gap', () => {
    const { container } = renderRows([
      itemRow(userText('user-1', new Date(2026, 4, 14, 9, 0, 0))),
      itemRow({ kind: 'assistant_text', key: 'reply-1', text: 'Yesterday.' }),
      itemRow(userText('user-2', new Date(2026, 4, 15, 10, 0, 0))),
    ]);

    const turns = container.querySelectorAll('[data-turn]');
    expect(turns).toHaveLength(2);
    expect(turns[1]?.querySelector('ul > li:first-child')?.getAttribute('data-testid')).toBe(
      'transcript-day',
    );
  });
});
