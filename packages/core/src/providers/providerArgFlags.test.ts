import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, type CatalogModel, type ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { modelHasEffortAxis } from './modelHasEffortAxis';
import { resolveModelArgs } from './resolveModelArgs';
import { extractSpawnModel } from './providerArgFlags';

type ExpectedFlags = {
  readonly modelFlag: string;
  readonly effortFlag: string | null;
};

const EXPECTED_FLAGS_BY_PROVIDER = {
  anthropic: { modelFlag: '--model', effortFlag: '--effort' },
  cursor: { modelFlag: '--model', effortFlag: null },
  codex: { modelFlag: '-m', effortFlag: null },
  gemini: { modelFlag: '--model', effortFlag: '--effort' },
  copilot: { modelFlag: '--model', effortFlag: '--reasoning-effort' },
  opencode: { modelFlag: '-m', effortFlag: '--variant' },
  openrouter: { modelFlag: '-m', effortFlag: '--variant' },
  moonshot: { modelFlag: '-m', effortFlag: '--variant' },
} satisfies Readonly<Record<ProviderId, ExpectedFlags>>;

describe('extractSpawnModel', () => {
  it.each(PROVIDER_IDS)(
    'extracts the real cli model id resolveModelArgs placed for %s, never a flag literal',
    (provider) => {
      const model = MODEL_CATALOGS[provider][0];
      if (model == null) {
        throw new Error(`catalog empty for ${provider}`);
      }
      const resolved = resolveModelArgs({ provider, selection: { key: model.key } });
      const { modelFlag } = EXPECTED_FLAGS_BY_PROVIDER[provider];
      const flagIndex = resolved.args.indexOf(modelFlag);
      expect(flagIndex).toBeGreaterThanOrEqual(0);
      const expectedToken = resolved.args[flagIndex + 1];
      expect(expectedToken).toBeDefined();
      expect(expectedToken?.startsWith('-')).toBe(false);

      expect(extractSpawnModel({ provider, args: resolved.args })).toBe(expectedToken);
    },
  );

  it('throws naming the provider and the expected flag when that flag is absent from the args', () => {
    expect(() => extractSpawnModel({ provider: 'gemini', args: ['--effort', 'low'] })).toThrow(
      /gemini.*--model/,
    );
  });

  it('never falls back to returning the flag literal itself when the flag is missing', () => {
    expect(() => extractSpawnModel({ provider: 'codex', args: ['-m'] })).toThrow();
  });
});

describe('PROVIDER_ARG_FLAGS coverage', () => {
  it('matches the flags resolveModelArgs actually emits for every provider', () => {
    for (const provider of PROVIDER_IDS) {
      const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
      const model = catalog.find((candidate) => modelHasEffortAxis({ model: candidate }));
      if (model == null) {
        throw new Error(`no model with an effort axis for ${provider}`);
      }
      const resolved = resolveModelArgs({ provider, selection: { key: model.key } });
      const expected = EXPECTED_FLAGS_BY_PROVIDER[provider];
      if (expected.effortFlag != null) {
        expect(resolved.args).toContain(expected.effortFlag);
      }
    }
  });

  it('sends no effort flag for a model that publishes no effort levels', () => {
    expect(resolveModelArgs({ provider: 'opencode', selection: { key: 'big-pickle' } })).toEqual({
      args: ['-m', 'opencode/big-pickle'],
    });
    expect(
      resolveModelArgs({ provider: 'opencode', selection: { key: 'big-pickle', effort: 'high' } }),
    ).toEqual({ args: ['-m', 'opencode/big-pickle'] });
  });
});
