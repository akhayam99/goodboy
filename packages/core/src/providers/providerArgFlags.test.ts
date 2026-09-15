import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
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
      const model = MODEL_CATALOGS[provider][0];
      if (model == null) {
        throw new Error(`catalog empty for ${provider}`);
      }
      const resolved = resolveModelArgs({ provider, selection: { key: model.key } });
      const expected = EXPECTED_FLAGS_BY_PROVIDER[provider];
      if (expected.effortFlag != null) {
        expect(resolved.args).toContain(expected.effortFlag);
      }
    }
  });
});
