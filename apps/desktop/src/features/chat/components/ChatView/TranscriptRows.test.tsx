// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TranscriptRow } from '../../utils/cluster-operations';

vi.mock('../TranscriptCards', () => ({
  TranscriptCard: ({ item }: { item: TranscriptItem }) => <div data-testid="card">{item.kind}</div>,
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

import { TranscriptRows } from './TranscriptRows';

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
        thinkingContext="think"
      />
    </ul>,
  );

afterEach(cleanup);

describe('TranscriptRows', () => {
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
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('keeps the day boundary chip across a run completion', () => {
    const { container } = renderRows([
      itemRow(userText('u1', new Date(2026, 4, 15, 9, 0, 0))),
      itemRow({ kind: 'done', key: 'done-1' }),
      itemRow(userText('u2', new Date(2026, 4, 16, 9, 0, 0))),
    ]);
    expect(screen.getAllByTestId('card')).toHaveLength(2);
    expect(container.querySelectorAll('li')).toHaveLength(4);
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
});
