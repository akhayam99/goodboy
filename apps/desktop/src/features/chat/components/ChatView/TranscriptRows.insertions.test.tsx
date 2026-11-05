// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

type EchoParams = {
  readonly key: string;
  readonly text: string;
  readonly outboxId: string;
  readonly at: Date;
};

const reply = (key: string, text: string): TranscriptRow =>
  itemRow({ kind: 'assistant_text', key, text });

const insertion = (key: string, beforeMs: number | null): TranscriptInsertion => ({
  key,
  beforeMs,
  node: <div data-testid="inserted">{key}</div>,
});

const textsOf = (container: HTMLElement): ReadonlyArray<string> =>
  [...container.querySelectorAll('[data-turn] > ul > li')].map((li) => li.textContent ?? '');

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
        thinkingPhrase="Thinking"
        onRetryRun={() => undefined}
        retryingRunId={null}
        insertions={insertions}
      />
    </ul>,
  );

const SECOND = 1_000;
const NOW = new Date(2026, 9, 20, 12, 0, 0);
const T0 = new Date(NOW.getTime() - 30 * SECOND);
const T1 = new Date(NOW.getTime() - 20 * SECOND);
const T2 = new Date(NOW.getTime() - 10 * SECOND);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

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

  it('draws no bubble for a message Auto has not read, and one at its delivery after', () => {
    const echo = ({ key, text, outboxId, at }: EchoParams): TranscriptRow =>
      itemRow({
        kind: 'user_text',
        key,
        text,
        isOperatorEcho: true,
        outboxId,
        at: brandId<IsoDateTime>({ value: at.toISOString() }),
      });
    const delivery = (outboxIds: ReadonlyArray<string>): TranscriptRow =>
      itemRow({
        kind: 'auto_delivery',
        key: 'd1',
        runId: brandId<ProviderRunId>({ value: 'run-1' }),
        text: 'MESSAGES FROM THE USER',
        outboxIds,
        at: brandId<IsoDateTime>({ value: T2.toISOString() }),
      });
    const waiting = renderRows({
      rows: [
        user({ key: 'u1', text: 'goal', at: T0 }),
        echo({ key: 'e1', text: 'first', outboxId: 'row-1', at: T1 }),
      ],
      insertions: [insertion('batch-open', null)],
    });

    expect(textsOf(waiting.container).filter((text) => text.includes('first'))).toEqual([]);
    cleanup();
    const delivered = renderRows({
      rows: [
        user({ key: 'u1', text: 'goal', at: T0 }),
        reply('r1', 'working on it'),
        echo({ key: 'e1', text: 'first', outboxId: 'row-1', at: T1 }),
        delivery(['row-1']),
      ],
      insertions: [],
    });

    const texts = textsOf(delivered.container).filter(
      (text) => text !== '' && !text.startsWith('Oct'),
    );
    expect(texts.indexOf('first')).toBeGreaterThan(texts.indexOf('assistant_text'));
    expect(texts.indexOf('first')).toBeLessThan(texts.indexOf('auto_delivery'));
  });

  it('moves an approval into the card that follows it and keeps a free message', () => {
    const claimingCard: TranscriptInsertion = {
      key: 'building',
      beforeMs: NOW.getTime(),
      claimsReply: ({ text }) => text.startsWith('Approved plan'),
      node: ({ replies }) => (
        <div data-testid="inserted">{replies.map((item) => `you:${item.text}`).join('|')}</div>
      ),
    };
    const { container } = renderRows({
      rows: [
        user({ key: 'u1', text: 'goal', at: T0 }),
        user({ key: 'u2', text: 'Approved plan v1.', at: T1 }),
        user({ key: 'u3', text: 'also add a test', at: T2 }),
      ],
      insertions: [claimingCard],
    });

    const texts = textsOf(container).filter((text) => text !== '' && !text.startsWith('Oct'));
    expect(texts).toContain('you:Approved plan v1.');
    expect(texts).not.toContain('Approved plan v1.');
    expect(texts).toContain('also add a test');
  });

  it('renders nothing extra without insertions', () => {
    const { container } = renderRows({
      rows: [user({ key: 'u1', text: 'goal', at: T0 })],
      insertions: [],
    });

    expect(container.querySelectorAll('[data-testid="inserted"]')).toHaveLength(0);
  });
});
