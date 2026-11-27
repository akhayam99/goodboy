// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type AgentTurnSpanRoute, type ProviderRunId } from '@goodboy/types';
import { mergeRunHistory } from './mergeRunHistory';

const LEAD = brandId<AgentId>({ value: 'mock-lead' });

type RunParams = {
  readonly value: string;
};

const run = ({ value }: RunParams) => brandId<ProviderRunId>({ value });

type RouteParams = {
  readonly runId: ProviderRunId;
};

const routeOf = ({ runId }: RouteParams): AgentTurnSpanRoute => ({
  runId,
  agentId: LEAD,
  provider: 'anthropic',
  model: 'opus-5.5',
  effort: null,
});

describe('mergeRunHistory', () => {
  it('keeps a run saved only as a span after the older run that has events', () => {
    const older = run({ value: 'mock-run-a' });
    const newer = run({ value: 'mock-run-b' });

    const merged = mergeRunHistory({
      history: {},
      eventRunIds: new Map([[LEAD, [older]]]),
      routes: [routeOf({ runId: older }), routeOf({ runId: newer })],
    });

    expect(merged[LEAD]).toEqual([older, newer]);
  });

  it('keeps a span only run before the event run that started after it', () => {
    const older = run({ value: 'mock-run-a' });
    const newer = run({ value: 'mock-run-b' });

    const merged = mergeRunHistory({
      history: {},
      eventRunIds: new Map([[LEAD, [newer]]]),
      routes: [routeOf({ runId: older }), routeOf({ runId: newer })],
    });

    expect(merged[LEAD]).toEqual([older, newer]);
  });

  it('keeps a run started during the load as the newest', () => {
    const saved = run({ value: 'mock-run-a' });
    const live = run({ value: 'mock-run-live' });

    const merged = mergeRunHistory({
      history: { [LEAD]: [live] },
      eventRunIds: new Map([[LEAD, [saved]]]),
      routes: [routeOf({ runId: saved })],
    });

    expect(merged[LEAD]).toEqual([saved, live]);
  });
});
