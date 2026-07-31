import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { planTurnFallback, type TurnFailureKind, type TurnFallbackPlan } from './planTurnFallback';

const CONNECTED: ReadonlyArray<ProviderId> = ['anthropic', 'codex'];

type Row = {
  readonly name: string;
  readonly failure: TurnFailureKind;
  readonly provider: ProviderId;
  readonly model: string;
  readonly attempt: number;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly expected: TurnFallbackPlan | null;
};

const ROWS: ReadonlyArray<Row> = [
  {
    name: 'authentication leaves the broken provider for the next connected one',
    failure: 'authentication',
    provider: 'anthropic',
    model: 'opus-5',
    attempt: 0,
    connectedProviders: CONNECTED,
    expected: { provider: 'codex', model: 'gpt-5.6' },
  },
  {
    name: 'authentication gives up when no other provider is connected',
    failure: 'authentication',
    provider: 'anthropic',
    model: 'opus-5',
    attempt: 0,
    connectedProviders: ['anthropic'],
    expected: null,
  },
  {
    name: 'rate limit drops to a cheaper sibling on the same provider',
    failure: 'rate_limit',
    provider: 'anthropic',
    model: 'opus-5',
    attempt: 0,
    connectedProviders: CONNECTED,
    expected: { provider: 'anthropic', model: 'sonnet-5' },
  },
  {
    name: 'rate limit on the cheapest model crosses to another provider',
    failure: 'rate_limit',
    provider: 'anthropic',
    model: 'haiku-4.5',
    attempt: 0,
    connectedProviders: CONNECTED,
    expected: { provider: 'codex', model: 'gpt-5.4-mini' },
  },
  {
    name: 'rate limit on the second attempt crosses to another provider',
    failure: 'rate_limit',
    provider: 'anthropic',
    model: 'opus-5',
    attempt: 1,
    connectedProviders: CONNECTED,
    expected: { provider: 'codex', model: 'gpt-5.6' },
  },
  {
    name: 'unreachable retries the same provider and model once',
    failure: 'unreachable',
    provider: 'anthropic',
    model: 'opus-5',
    attempt: 0,
    connectedProviders: CONNECTED,
    expected: { provider: 'anthropic', model: 'opus-5' },
  },
  {
    name: 'unreachable moves to another provider on the second attempt',
    failure: 'unreachable',
    provider: 'anthropic',
    model: 'opus-5',
    attempt: 1,
    connectedProviders: CONNECTED,
    expected: { provider: 'codex', model: 'gpt-5.6' },
  },
  {
    name: 'model not available swaps to the nearest sibling on the same provider',
    failure: 'model_not_available',
    provider: 'anthropic',
    model: 'opus-5',
    attempt: 0,
    connectedProviders: CONNECTED,
    expected: { provider: 'anthropic', model: 'fable-5' },
  },
  {
    name: 'model not available crosses providers on the second attempt',
    failure: 'model_not_available',
    provider: 'codex',
    model: 'gpt-5.6',
    attempt: 1,
    connectedProviders: ['codex', 'gemini'],
    expected: { provider: 'gemini', model: 'gemini-3.1-pro' },
  },
  {
    name: 'an unclassified failure never retries',
    failure: 'other',
    provider: 'anthropic',
    model: 'opus-5',
    attempt: 0,
    connectedProviders: CONNECTED,
    expected: null,
  },
  {
    name: 'the attempt cap stops the second retry',
    failure: 'rate_limit',
    provider: 'anthropic',
    model: 'opus-5',
    attempt: 2,
    connectedProviders: CONNECTED,
    expected: null,
  },
  {
    name: 'an unknown failed model is treated as mid tier',
    failure: 'authentication',
    provider: 'anthropic',
    model: 'not-a-catalog-key',
    attempt: 0,
    connectedProviders: CONNECTED,
    expected: { provider: 'codex', model: 'gpt-5.4' },
  },
];

describe('planTurnFallback', () => {
  it.each(ROWS)('$name', ({ name: _name, expected, ...params }) => {
    expect(planTurnFallback(params)).toEqual(expected);
  });

  it('never proposes the failed pair again outside the unreachable first retry', () => {
    const failures: ReadonlyArray<TurnFailureKind> = [
      'authentication',
      'rate_limit',
      'model_not_available',
    ];
    const plans = failures.flatMap((failure) =>
      [0, 1].map((attempt) =>
        planTurnFallback({
          failure,
          provider: 'anthropic',
          model: 'opus-5',
          attempt,
          connectedProviders: CONNECTED,
        }),
      ),
    );

    expect(plans).not.toContainEqual({ provider: 'anthropic', model: 'opus-5' });
  });
});
