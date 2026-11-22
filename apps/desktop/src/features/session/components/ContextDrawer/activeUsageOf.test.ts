// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type ProviderName,
  type ProviderRunId,
  type SessionId,
  type TelemetryRecord,
  type TelemetryRecordId,
} from '@goodboy/types';
import { activeUsageOf } from './activeUsageOf';

const FIRST_RUN = brandId<ProviderRunId>({ value: 'harborline-run-1' });
const SECOND_RUN = brandId<ProviderRunId>({ value: 'harborline-run-2' });

type RecordParams = {
  readonly id: string;
  readonly runId: ProviderRunId;
  readonly provider: ProviderName;
  readonly contextTokens?: number;
  readonly recordedAt: string;
};

const turnOf = ({
  id,
  runId,
  provider,
  contextTokens,
  recordedAt,
}: RecordParams): TelemetryRecord => ({
  id: brandId<TelemetryRecordId>({ value: id }),
  runId,
  sessionId: brandId<SessionId>({ value: 'harborline-session' }),
  kind: 'turn',
  provider,
  model: 'kimi-k3',
  inputTokens: 1_000,
  outputTokens: 200,
  estimatedCostUsd: 0.1,
  recordedAt: brandId<IsoDateTime>({ value: recordedAt }),
  ...(contextTokens === undefined ? {} : { contextTokens }),
});

const OLD_ANTHROPIC = turnOf({
  id: 'old',
  runId: FIRST_RUN,
  provider: 'anthropic',
  contextTokens: 150_000,
  recordedAt: '2026-11-20T09:00:00.000Z',
});

const NEW_CURSOR = turnOf({
  id: 'new',
  runId: SECOND_RUN,
  provider: 'cursor',
  contextTokens: 20_000,
  recordedAt: '2026-11-20T10:00:00.000Z',
});

describe('activeUsageOf', () => {
  it('reads the latest turn of the active provider after a switch, not the largest', () => {
    const usage = activeUsageOf({
      agent: { providerSessionProviderId: 'cursor' },
      runIds: [FIRST_RUN, SECOND_RUN],
      telemetry: [OLD_ANTHROPIC, NEW_CURSOR],
    });

    expect(usage?.provider).toBe('cursor');
    expect(usage?.contextTokens).toBe(20_000);
  });

  it('reports nothing when the active provider has not reported usage yet', () => {
    const usage = activeUsageOf({
      agent: { providerSessionProviderId: 'codex', providerOverride: 'codex' },
      runIds: [FIRST_RUN, SECOND_RUN],
      telemetry: [OLD_ANTHROPIC, NEW_CURSOR],
    });

    expect(usage).toBeNull();
  });

  it('takes the latest turn of the same provider even when an older one was fuller', () => {
    const later = turnOf({
      id: 'later',
      runId: SECOND_RUN,
      provider: 'anthropic',
      contextTokens: 30_000,
      recordedAt: '2026-11-20T11:00:00.000Z',
    });

    const usage = activeUsageOf({
      agent: { providerOverride: 'anthropic' },
      runIds: [FIRST_RUN, SECOND_RUN],
      telemetry: [later, OLD_ANTHROPIC],
    });

    expect(usage?.contextTokens).toBe(30_000);
  });

  it('falls back to the agent run when no history is loaded', () => {
    const usage = activeUsageOf({
      agent: { runId: SECOND_RUN },
      runIds: undefined,
      telemetry: [OLD_ANTHROPIC, NEW_CURSOR],
    });

    expect(usage?.provider).toBe('cursor');
  });
});
