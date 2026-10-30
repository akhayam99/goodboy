// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import type { TranscriptRow } from '../../utils/cluster-operations';
import type { TranscriptItem } from '../../utils/transcript-items';
import { dayKey, formatDayLabel, rowAnchorOf } from './lib';

describe('dayKey', () => {
  it('returns "unknown" for an invalid date', () => {
    expect(dayKey('not-a-date')).toBe('unknown');
  });

  it('produces the same key for two times on the same calendar day', () => {
    const morning = new Date(2026, 4, 15, 8, 0, 0).toISOString();
    const evening = new Date(2026, 4, 15, 22, 0, 0).toISOString();
    expect(dayKey(morning)).toBe(dayKey(evening));
  });

  it('produces different keys for different calendar days', () => {
    const d1 = new Date(2026, 4, 15, 12, 0, 0).toISOString();
    const d2 = new Date(2026, 4, 16, 12, 0, 0).toISOString();
    expect(dayKey(d1)).not.toBe(dayKey(d2));
  });

  it('formats as year-month-day numbers', () => {
    expect(dayKey(new Date(2026, 4, 15, 12, 0, 0).toISOString())).toMatch(
      /^\d{4}-\d{1,2}-\d{1,2}$/,
    );
  });
});

describe('formatDayLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "" for an invalid date', () => {
    expect(formatDayLabel('nope')).toBe('');
  });

  it('labels a day of this year with its month and day only', () => {
    expect(formatDayLabel(new Date(2026, 4, 15, 9, 0, 0).toISOString())).toBe('May 15');
    expect(formatDayLabel(new Date(2026, 2, 1, 9, 0, 0).toISOString())).toBe('Mar 1');
  });

  it('adds the year to a day of another year', () => {
    expect(formatDayLabel(new Date(2025, 8, 27, 9, 0, 0).toISOString())).toBe('Sep 27, 2025');
  });

  it('pins the Intl locale to en-US for both branches', () => {
    const original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) {
      return new original(...args);
    } as never);
    formatDayLabel(new Date(2026, 4, 12, 9, 0, 0).toISOString());
    formatDayLabel(new Date(2026, 2, 1, 9, 0, 0).toISOString());
    expect(spy.mock.calls.map((call) => call[0])).toEqual(['en-US', 'en-US']);
    spy.mockRestore();
  });
});

const RUN = brandId<ProviderRunId>({ value: 'run-harborline-1' });
const AT = brandId<IsoDateTime>({ value: '2026-10-23T12:00:00.000Z' });

type CallParams = {
  readonly toolUseId: string;
};

const callOf = ({ toolUseId }: CallParams): TranscriptItem => ({
  kind: 'tool_call',
  key: `tool-${toolUseId}`,
  toolUseId,
  toolName: 'bash',
  input: {},
  output: null,
  isError: false,
  ended: true,
  runId: RUN,
  startedAt: AT,
  endedAt: AT,
});

describe('rowAnchorOf', () => {
  it('lists every tool call a cluster holds so a link can find its row', () => {
    const row: TranscriptRow = {
      kind: 'operations',
      key: 'ops-tool-a',
      items: [callOf({ toolUseId: 'a' }), callOf({ toolUseId: 'b' })],
    };

    expect(rowAnchorOf({ row, heightKey: 'k' })).toEqual({
      'data-anchor-key': 'k',
      'data-tool-use-ids': 'a b',
    });
  });

  it('adds nothing for a row without a tool call', () => {
    const row: TranscriptRow = {
      kind: 'item',
      key: 'assistant-1',
      item: { kind: 'assistant_text', key: 'assistant-1', text: 'Done' },
    };

    expect(rowAnchorOf({ row, heightKey: 'k' })).toEqual({ 'data-anchor-key': 'k' });
  });
});
