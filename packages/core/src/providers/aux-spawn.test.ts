import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { runAuxOneShot } from './aux-spawn';
import { cliModelId } from './cliModelId';
import { getCheapModel } from './cli-defaults';
import { MODEL_CATALOGS } from './catalogs';

const PROVIDERS: ReadonlyArray<ProviderId> = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
];

const capture = () => {
  const seen: Array<Record<string, unknown>> = [];
  const invokeFn = async <T>(_cmd: string, args?: Record<string, unknown>): Promise<T> => {
    seen.push((args?.['args'] as Record<string, unknown>) ?? {});
    return { stdout: '', stderr: '', exitCode: 0 } as T;
  };
  return { seen, invokeFn };
};

describe('runAuxOneShot', () => {
  it('sends the cli id, never the catalog key', async () => {
    const { seen, invokeFn } = capture();

    await runAuxOneShot({
      providerId: 'anthropic',
      model: 'haiku-4.5',
      binary: 'claude',
      userMessage: 'u',
      systemPrompt: 's',
      invokeFn,
    });

    expect(seen[0]?.['model']).toBe('claude-haiku-4-5');
  });

  it('passes through an id that is not a catalog key', async () => {
    const { seen, invokeFn } = capture();

    await runAuxOneShot({
      providerId: 'anthropic',
      model: 'claude-sonnet-4-6',
      binary: 'claude',
      userMessage: 'u',
      systemPrompt: 's',
      invokeFn,
    });

    expect(seen[0]?.['model']).toBe('claude-sonnet-4-6');
  });

  it('omits workingDir when it is absent', async () => {
    const { seen, invokeFn } = capture();

    await runAuxOneShot({
      providerId: 'codex',
      model: getCheapModel('codex'),
      binary: 'codex',
      userMessage: 'u',
      systemPrompt: 's',
      invokeFn,
    });

    expect(seen[0]).not.toHaveProperty('workingDir');
  });
});

describe('cliModelId', () => {
  it('resolves every cheap model to an id its cli accepts', () => {
    const expected: Record<ProviderId, string> = {
      anthropic: 'claude-haiku-4-5',
      cursor: 'auto',
      codex: 'gpt-5.4-mini',
      gemini: 'gemini-3.5-flash',
      opencode: 'opencode/minimax-m2.5-free',
      openrouter: 'openrouter/deepseek/deepseek-v4',
    };

    for (const provider of PROVIDERS) {
      expect(cliModelId({ provider, model: getCheapModel(provider) })).toBe(expected[provider]);
    }
  });

  it('is idempotent, so a resolved id survives a second pass', () => {
    for (const provider of PROVIDERS) {
      for (const model of MODEL_CATALOGS[provider]) {
        const once = cliModelId({ provider, model: model.key });
        expect(cliModelId({ provider, model: once })).toBe(once);
      }
    }
  });
});
