import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from './transcript-items';
import { turnFootersFor } from './turnOutcome';

const runId = (value: string): ProviderRunId => JSON.parse(JSON.stringify(value));
const iso = (value: string): IsoDateTime => JSON.parse(JSON.stringify(value));

const RUN_1 = runId('run-1');
const RUN_2 = runId('run-2');

const usage = (id: ProviderRunId, at = '2026-06-08T10:00:05.000Z'): TranscriptItem => ({
  kind: 'usage',
  key: `usage-${id}`,
  usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, estimatedCostUsd: 0 },
  runId: id,
  at: iso(at),
});

const tool = (id: ProviderRunId, startedAt: string): TranscriptItem => ({
  kind: 'tool_call',
  key: `tool-${id}`,
  toolUseId: `t-${id}`,
  toolName: 'bash',
  input: null,
  output: null,
  isError: false,
  ended: true,
  runId: id,
  startedAt: iso(startedAt),
  endedAt: iso(startedAt),
});

const done = (id: ProviderRunId): TranscriptItem => ({
  kind: 'done',
  key: `done-${id}`,
  runId: id,
});

const error = (id: ProviderRunId): TranscriptItem => ({
  kind: 'error',
  key: `error-${id}`,
  message: 'boom',
  runId: id,
});

describe('turnFootersFor', () => {
  it('marks a run done once its done item lands, and takes its start from the earliest timed item', () => {
    const footers = turnFootersFor({
      items: [tool(RUN_1, '2026-06-08T10:00:00.000Z'), usage(RUN_1), done(RUN_1)],
    });
    expect(footers.get(RUN_1)).toEqual({
      outcome: 'done',
      startedAt: iso('2026-06-08T10:00:00.000Z'),
    });
  });

  it('marks a run failed once an error lands for it, even after a done', () => {
    const footers = turnFootersFor({ items: [usage(RUN_1), error(RUN_1)] });
    expect(footers.get(RUN_1)?.outcome).toBe('failed');
  });

  it('assumes done when the caller does not vouch for the active run', () => {
    const footers = turnFootersFor({ items: [usage(RUN_1)] });
    expect(footers.get(RUN_1)?.outcome).toBe('done');
  });

  it('marks a run stopped once a later run is active and it never reached done', () => {
    const footers = turnFootersFor({ items: [usage(RUN_1)], activeRunId: RUN_2 });
    expect(footers.get(RUN_1)?.outcome).toBe('stopped');
  });

  it('marks a run stopped once the turn has ended with no done or error', () => {
    const footers = turnFootersFor({ items: [usage(RUN_1)], activeRunId: null });
    expect(footers.get(RUN_1)?.outcome).toBe('stopped');
  });

  it('keeps the still-active run done while it is the one showing usage', () => {
    const footers = turnFootersFor({ items: [usage(RUN_1)], activeRunId: RUN_1 });
    expect(footers.get(RUN_1)?.outcome).toBe('done');
  });

  it('falls back to the usage timestamp for startedAt when no other timed item exists', () => {
    const footers = turnFootersFor({ items: [usage(RUN_1, '2026-06-08T10:00:05.000Z')] });
    expect(footers.get(RUN_1)?.startedAt).toBe(iso('2026-06-08T10:00:05.000Z'));
  });

  it('tracks outcomes for multiple runs independently', () => {
    const footers = turnFootersFor({
      items: [usage(RUN_1), done(RUN_1), usage(RUN_2), error(RUN_2)],
    });
    expect(footers.get(RUN_1)?.outcome).toBe('done');
    expect(footers.get(RUN_2)?.outcome).toBe('failed');
  });

  it('only reports runs that produced usage', () => {
    const footers = turnFootersFor({ items: [tool(RUN_1, '2026-06-08T10:00:00.000Z')] });
    expect(footers.has(RUN_1)).toBe(false);
  });
});
