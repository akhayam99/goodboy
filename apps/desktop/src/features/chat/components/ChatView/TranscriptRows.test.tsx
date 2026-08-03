// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TranscriptRow } from '../../utils/cluster-operations';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';

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

const retryErrorSpy = vi.fn();

const itemRow = (item: TranscriptItem): TranscriptRow => ({ kind: 'item', key: item.key, item });

const userText = (key: string, at: Date): TranscriptItem => ({
  kind: 'user_text',
  key,
  text: 'hello',
  at: at.toISOString() as IsoDateTime,
});

const spawnedChild = (name: string, ordinal: number): SpawnedChild => ({
  agent: {
    id: `${name}-id` as AgentId,
    sessionId: 's1',
    ordinal,
    name,
    status: 'running',
  } as Agent,
  index: ordinal,
  total: 2,
  status: 'running',
  assignment: `look at ${name}`,
});

const renderRows = (
  rows: ReadonlyArray<TranscriptRow>,
  oqByTurnOrdinal: ReadonlyMap<number | null, ReadonlyArray<never>> = new Map(),
  spawned: ReadonlyArray<SpawnedChild> = [],
  spawnAnchorKey: string | null = null,
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
        onRetryError={retryErrorSpy}
        retryingErrorRunId={null}
        spawned={spawned}
        spawnAnchorKey={spawnAnchorKey}
      />
    </ul>,
  );

afterEach(cleanup);

const kickoff = (key: string): TranscriptItem => ({
  kind: 'workflow_kickoff',
  key,
  at: new Date(2026, 4, 15, 9, 0, 0).toISOString() as IsoDateTime,
  goal: 'ship it',
  instructions: '',
  marker: '',
  raw: 'raw',
  parsed: true,
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
      itemRow(kickoff('k1')),
      itemRow(decision('d1')),
      itemRow({ kind: 'assistant_text', key: 'a1', text: 'hi' }),
    ]);
    const rows = container.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.className).toContain('flex flex-col');
    expect(rows[0]!.querySelectorAll('[data-testid="card"]')).toHaveLength(2);
  });

  it('breaks the rail group when a non-workflow row interrupts it', () => {
    const { container } = renderRows([
      itemRow(kickoff('k1')),
      itemRow({ kind: 'assistant_text', key: 'a1', text: 'hi' }),
      itemRow(decision('d1')),
    ]);
    expect(container.querySelectorAll('li')).toHaveLength(3);
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

  it('keeps the spawned-children record in the transcript once turns exist', () => {
    const { container } = renderRows(
      [
        itemRow(userText('u1', new Date(2026, 4, 15, 9, 0, 0))),
        itemRow({ kind: 'assistant_text', key: 'a1', text: 'splitting' }),
        itemRow({ kind: 'assistant_text', key: 'a2', text: 'later turn' }),
      ],
      new Map(),
      [spawnedChild('auth', 0), spawnedChild('routing', 1)],
      'a1',
    );
    expect(screen.getByTestId('spawned-children-card')).toBeTruthy();
    expect(screen.getByText('look at auth')).toBeTruthy();
    const listItems = [...container.querySelectorAll(':scope > ul > li')];
    const cardIndex = listItems.findIndex(
      (node) => node.querySelector('[data-testid="spawned-children-card"]') !== null,
    );
    expect(cardIndex).toBe(3);
    expect(listItems).toHaveLength(5);
  });

  it('renders the spawned-children record on its own when the transcript is empty', () => {
    renderRows([], new Map(), [spawnedChild('auth', 0)], null);
    expect(screen.getByTestId('spawned-children-card')).toBeTruthy();
    expect(screen.getByText('look at auth')).toBeTruthy();
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
