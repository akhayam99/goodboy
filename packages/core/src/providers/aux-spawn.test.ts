import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, type CatalogModel } from '@goodboy/types';
import { runAuxOneShot } from './aux-spawn';
import { cliModelId } from './cliModelId';
import { getCheapModel } from './cli-defaults';
import { MODEL_CATALOGS } from './catalogs';

const capture = () => {
  const seen: Array<Record<string, unknown>> = [];
  const invokeFn = async <T>(_cmd: string, args?: Record<string, unknown>): Promise<T> => {
    seen.push((args?.['args'] as Record<string, unknown>) ?? {});
    return { stdout: '', stderr: '', exitCode: 0 } as T;
  };
  return { seen, invokeFn };
};

type ExpectedCliIdParams = {
  readonly model: CatalogModel;
};

const expectedCliId = ({ model }: ExpectedCliIdParams): string => {
  switch (model.provider) {
    case 'anthropic':
    case 'gemini':
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
      return model.cliId;
    case 'codex':
      return model.variants[0]?.cliId ?? '';
    case 'cursor':
      return model.combos.find((combo) => combo.maxMode === false)?.slug ?? 'auto';
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
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

  it('degrades a max-only cursor catalog model to auto', async () => {
    const { seen, invokeFn } = capture();

    await runAuxOneShot({
      providerId: 'cursor',
      model: 'opus-5',
      binary: 'cursor-agent',
      userMessage: 'u',
      systemPrompt: 's',
      invokeFn,
    });

    expect(seen[0]?.['model']).toBe('auto');
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
  it('maps the anthropic cheap catalog key to its spawnable cli id', () => {
    expect(getCheapModel('anthropic')).toBe('haiku-4.5');
    expect(cliModelId({ provider: 'anthropic', model: 'haiku-4.5' })).toBe('claude-haiku-4-5');
  });

  it('resolves every provider cheap model to its catalog cli id', () => {
    for (const provider of PROVIDER_IDS) {
      const cheapModel = getCheapModel(provider);
      const catalogEntry = MODEL_CATALOGS[provider].find((model) => model.key === cheapModel);
      expect(catalogEntry).toBeDefined();
      if (catalogEntry == null) {
        continue;
      }
      const mapped = cliModelId({ provider, model: cheapModel });
      const expected = expectedCliId({ model: catalogEntry });
      expect(mapped).toBe(expected);
      if (cheapModel !== expected) {
        expect(mapped).not.toBe(cheapModel);
      }
    }
  });

  it('is idempotent, so a resolved id survives a second pass', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of MODEL_CATALOGS[provider]) {
        const once = cliModelId({ provider, model: model.key });
        expect(cliModelId({ provider, model: once })).toBe(once);
      }
    }
  });
});
