// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { brandId, type AgentId, type IsoDateTime, type SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TranscriptRow } from '../../utils/cluster-operations';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';

vi.mock('../TranscriptCards', () => ({
  TranscriptCard: ({ item }: { item: TranscriptItem }) => (
    <div data-testid="card">{item.kind === 'user_text' ? item.text : item.kind}</div>
  ),
}));
vi.mock('../OperationsCluster', () => ({ OperationsCluster: () => <div data-testid="ops" /> }));
vi.mock('../ThinkingIndicator', () => ({
  ThinkingIndicator: () => <div data-testid="thinking" />,
}));
vi.mock('./OpenQuestionCluster', () => ({ OpenQuestionCluster: () => <div data-testid="oq" /> }));

import { TranscriptRows } from './TranscriptRows';

afterEach(cleanup);

const SESSION_ID = brandId<SessionId>({ value: 's1' });
const AGENT_ID = brandId<AgentId>({ value: 'a1' });

const itemRow = (item: TranscriptItem): TranscriptRow => ({ kind: 'item', key: item.key, item });

type UserParams = {
  readonly key: string;
  readonly text: string;
  readonly at: Date;
};

const user = ({ key, text, at }: UserParams): TranscriptRow =>
  itemRow({ kind: 'user_text', key, text, at: brandId<IsoDateTime>({ value: at.toISOString() }) });

const reply = (key: string, text: string): TranscriptRow =>
  itemRow({ kind: 'assistant_text', key, text });

const insertion = (key: string, beforeMs: number | null): TranscriptInsertion => ({
  key,
  beforeMs,
  node: <div data-testid="inserted">{key}</div>,
});

const textsOf = (container: HTMLElement): ReadonlyArray<string> =>
  [...container.querySelectorAll('li')].map((li) => li.textContent ?? '');

const renderRows = ({
  rows,
  insertions,
}: {
  readonly rows: ReadonlyArray<TranscriptRow>;
  readonly insertions: ReadonlyArray<TranscriptInsertion>;
}) =>
  render(
    <ul>
      <TranscriptRows
        rows={rows}
        oqByTurnOrdinal={new Map()}
        sessionId={SESSION_ID}
        selectedAgentId={AGENT_ID}
        workingDir={null}
        onRefreshAuth={() => undefined}
        onOpenDiff={() => undefined}
        isThinking={false}
        thinkingContext="think"
        onRetryRun={() => undefined}
        retryingRunId={null}
        insertions={insertions}
      />
    </ul>,
  );

const SECOND = 1_000;
const T0 = new Date(Date.now() - 30 * SECOND);
const T1 = new Date(Date.now() - 20 * SECOND);
const T2 = new Date(Date.now() - 10 * SECOND);

describe('transcript insertions', () => {
  it('seats a card before the first message sent after its work settled', () => {
    const { container } = renderRows({
      rows: [
        user({ key: 'u1', text: 'goal', at: T0 }),
        reply('r1', 'a planner goes first'),
        user({ key: 'u2', text: 'Approved plan v1.', at: T2 }),
        reply('r2', 'plan approved'),
      ],
      insertions: [insertion('batch-1', T1.getTime())],
    });

    expect(textsOf(container).filter((text) => text !== '' && !text.startsWith('Oct'))).toEqual([
      'goal',
      'assistant_text',
      'batch-1',
      'Approved plan v1.',
      'assistant_text',
    ]);
  });

  it('keeps a card whose work is still open at the end of the conversation', () => {
    const { container } = renderRows({
      rows: [user({ key: 'u1', text: 'goal', at: T0 }), reply('r1', 'working on it')],
      insertions: [insertion('batch-open', null)],
    });

    const texts = textsOf(container);
    expect(texts[texts.length - 1]).toBe('batch-open');
  });

  it('places two batches in order and each only once', () => {
    const { container, rerender } = renderRows({
      rows: [
        user({ key: 'u1', text: 'goal', at: T0 }),
        user({ key: 'u2', text: 'Approved plan v1.', at: T2 }),
      ],
      insertions: [insertion('a', T1.getTime()), insertion('b', null)],
    });

    expect(container.querySelectorAll('[data-testid="inserted"]')).toHaveLength(2);
    expect(textsOf(container).indexOf('a')).toBeLessThan(textsOf(container).indexOf('b'));
    rerender(<ul />);
  });

  it('renders nothing extra without insertions', () => {
    const { container } = renderRows({
      rows: [user({ key: 'u1', text: 'goal', at: T0 })],
      insertions: [],
    });

    expect(container.querySelectorAll('[data-testid="inserted"]')).toHaveLength(0);
  });
});
