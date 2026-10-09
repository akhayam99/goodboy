import { describe, expect, it, vi } from 'vitest';
import type { ProviderId, TaskModelPreference } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import {
  BACKGROUND_BUDGET_MS,
  BACKGROUND_MAX_ATTEMPTS,
  BACKGROUND_SAME_MODEL_BACKOFF_MS,
  runWithModelFallback,
  type BackgroundPool,
} from './background-retry';
import type { TurnFailureKind } from './planTurnFallback';

const FIRST: TaskModelPreference = { providerId: 'cursor', model: 'composer-2.5' };

const POOL: BackgroundPool = {
  connectedProviders: ['cursor', 'anthropic', 'codex'],
  enabledProviders: null,
  coolingDownProviders: [],
};

const classify = (error: string): TurnFailureKind => {
  if (/usage limit/i.test(error)) {
    return 'usage_limit';
  }
  if (/401/.test(error)) {
    return 'authentication';
  }
  return 'other';
};

type Script = ReadonlyArray<string | null>;

const scripted = (script: Script) => {
  const providers: Array<ProviderId> = [];
  const run = vi.fn(async (model: TaskModelPreference): Promise<string> => {
    providers.push(model.providerId);
    const step = script[providers.length - 1];
    if (step === undefined || step === null) {
      return `summary from ${model.providerId}`;
    }
    throw new Error(step);
  });
  return { run, providers };
};

const chain = (
  script: Script,
  over: Partial<Parameters<typeof runWithModelFallback<string>>[0]> = {},
) => {
  const { run, providers } = scripted(script);
  const sleep = vi.fn(async () => undefined);
  const result = runWithModelFallback({
    first: FIRST,
    run,
    classify,
    describe: (error) => (error instanceof Error ? error.message : String(error)),
    pool: () => POOL,
    sleep,
    ...over,
  });
  return { result, providers, sleep };
};

describe('runWithModelFallback', () => {
  it('returns the first answer without retrying or sleeping', async () => {
    const { result, providers, sleep } = chain([null]);

    expect(await result).toMatchObject({ ok: true, value: 'summary from cursor', attempts: [] });
    expect(providers).toEqual(['cursor']);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a generic exit on the same model once, after a backoff', async () => {
    const { result, providers, sleep } = chain(['summarizer cli exited with code 1', null]);

    expect(await result).toMatchObject({ ok: true, value: 'summary from cursor' });
    expect(providers).toEqual(['cursor', 'cursor']);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(BACKGROUND_SAME_MODEL_BACKOFF_MS);
  });

  it('moves to another provider after the same model failed twice, waiting only before the retry', async () => {
    const { result, providers, sleep } = chain([
      'summarizer cli exited with code 1',
      'summarizer cli exited with code 1',
      null,
    ]);

    const outcome = await result;

    expect(outcome).toMatchObject({ ok: true, value: 'summary from anthropic' });
    expect(providers).toEqual(['cursor', 'cursor', 'anthropic']);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('skips the same-model retry for a quota failure', async () => {
    const { result, providers, sleep } = chain(['Cursor usage limit reached', null]);

    expect(await result).toMatchObject({ ok: true, value: 'summary from anthropic' });
    expect(providers).toEqual(['cursor', 'anthropic']);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('skips the same-model retry for an authentication failure', async () => {
    const { result, providers } = chain(['401 unauthorized', null]);

    expect(await result).toMatchObject({ ok: true });
    expect(providers).toEqual(['cursor', 'anthropic']);
  });

  it('goes straight to the next provider after a timeout', async () => {
    const { result, providers, sleep } = chain(['step output summarization timed out', null]);

    expect(await result).toMatchObject({ ok: true, value: 'summary from anthropic' });
    expect(providers).toEqual(['cursor', 'anthropic']);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('never returns to a provider that already failed in this chain', async () => {
    const { result, providers } = chain([
      'Cursor usage limit reached',
      'Claude usage limit reached',
      null,
    ]);

    expect(await result).toMatchObject({ ok: true, value: 'summary from codex' });
    expect(providers).toEqual(['cursor', 'anthropic', 'codex']);
  });

  it('skips a provider the pool reports as cooling down', async () => {
    const { result, providers } = chain(['Cursor usage limit reached', null], {
      pool: () => ({ ...POOL, coolingDownProviders: ['anthropic'] }),
    });

    expect(await result).toMatchObject({ ok: true, value: 'summary from codex' });
    expect(providers).toEqual(['cursor', 'codex']);
  });

  it('stays inside the enabled providers', async () => {
    const { result, providers } = chain(['Cursor usage limit reached'], {
      pool: () => ({ ...POOL, enabledProviders: ['cursor', 'codex'] }),
    });

    expect(await result).toMatchObject({ ok: true, value: 'summary from codex' });
    expect(providers).toEqual(['cursor', 'codex']);
  });

  it('never falls back to a hidden model', async () => {
    const hidden = {
      anthropic: PROVIDER_CAPABILITIES.anthropic.models.map((model) => model.id),
    };
    const { result, providers } = chain(['Cursor usage limit reached', null], {
      pool: () => ({ ...POOL, hidden }),
    });

    expect(await result).toMatchObject({ ok: true, value: 'summary from codex' });
    expect(providers).toEqual(['cursor', 'codex']);
  });

  it('gives up with every attempt recorded when nothing is left', async () => {
    const { result, providers } = chain(
      ['Cursor usage limit reached', 'Claude usage limit reached', 'Codex usage limit reached'],
      { pool: () => POOL },
    );

    const outcome = await result;

    expect(providers).toEqual(['cursor', 'anthropic', 'codex']);
    expect(outcome.ok).toBe(false);
    expect(outcome.attempts.map((attempt) => attempt.failure)).toEqual([
      'usage_limit',
      'usage_limit',
      'usage_limit',
    ]);
    expect(outcome).toMatchObject({ error: 'Codex usage limit reached' });
  });

  it('stops when there is no other provider to try', async () => {
    const { result, providers } = chain(['Cursor usage limit reached'], {
      pool: () => ({ ...POOL, connectedProviders: ['cursor'] }),
    });

    expect((await result).ok).toBe(false);
    expect(providers).toEqual(['cursor']);
  });

  it('is bounded by the attempt cap', async () => {
    const failing = Array.from({ length: 10 }, () => 'summarizer cli exited with code 1');
    const { result, providers } = chain(failing);

    expect((await result).ok).toBe(false);
    expect(providers).toHaveLength(BACKGROUND_MAX_ATTEMPTS);
  });

  it('is bounded by the total time budget', async () => {
    let clock = 0;
    const { result, providers } = chain(
      ['summarizer cli exited with code 1', 'summarizer cli exited with code 1', null],
      {
        now: () => clock,
        sleep: async () => {
          clock += BACKGROUND_BUDGET_MS;
        },
      },
    );

    expect((await result).ok).toBe(false);
    expect(providers).toEqual(['cursor', 'cursor']);
  });

  it('stops when the caller discards the work', async () => {
    const { result, providers } = chain(['summarizer cli exited with code 1', null], {
      shouldStop: () => true,
    });

    expect((await result).ok).toBe(false);
    expect(providers).toEqual(['cursor']);
  });

  it('reports each failure to the caller as it happens', async () => {
    const onFailure = vi.fn();
    const { result } = chain(['Cursor usage limit reached', null], { onFailure });

    await result;

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({
      model: FIRST,
      error: 'Cursor usage limit reached',
      failure: 'usage_limit',
    });
  });
});
