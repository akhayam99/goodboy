import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { buildRetryOverride } from './buildRetryOverride';
import { findRetrySource } from './findRetrySource';

const AT = brandId<IsoDateTime>({ value: '2026-10-10T09:00:00.000Z' });
const FIRST_RUN = brandId<ProviderRunId>({ value: 'run-ledger-1' });
const SECOND_RUN = brandId<ProviderRunId>({ value: 'run-ledger-2' });

type UserTextParams = {
  readonly runId: ProviderRunId;
  readonly text: string;
};

const userText = ({ runId, text }: UserTextParams): TurnEvent => ({
  kind: 'user_text',
  runId,
  text,
  at: AT,
});

describe('findRetrySource', () => {
  it('answers null when the run has no user message', () => {
    expect(findRetrySource({ events: [], runId: FIRST_RUN })).toBeNull();
  });

  it('finds the user message of the asked run, not of another run', () => {
    const source = findRetrySource({
      events: [
        userText({ runId: FIRST_RUN, text: 'post the batch' }),
        userText({ runId: SECOND_RUN, text: 'roll it back' }),
      ],
      runId: FIRST_RUN,
    });

    expect(source?.content).toBe('post the batch');
    expect(source?.attachments).toEqual([]);
  });

  it('takes the latest user message when a run has several', () => {
    const source = findRetrySource({
      events: [
        userText({ runId: FIRST_RUN, text: 'draft' }),
        userText({ runId: FIRST_RUN, text: 'final' }),
      ],
      runId: FIRST_RUN,
    });

    expect(source?.content).toBe('final');
  });
});

describe('buildRetryOverride', () => {
  it('overrides nothing when the first run named no provider', () => {
    expect(buildRetryOverride({ model: 'sonnet' })).toBeUndefined();
  });

  it('keeps the provider alone when no model was named', () => {
    expect(buildRetryOverride({ provider: 'codex' })).toEqual({ providerId: 'codex' });
  });

  it('keeps the provider and the model together', () => {
    expect(buildRetryOverride({ provider: 'anthropic', model: 'sonnet' })).toEqual({
      providerId: 'anthropic',
      model: 'sonnet',
    });
  });
});
