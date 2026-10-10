import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { explainResolution, type ResolveNames } from './explainResolution';
import type { Resolution } from './types';

const LABELS: Partial<Record<ProviderId, string>> = {
  anthropic: 'Anthropic',
  codex: 'Codex',
};

const MODELS: Record<string, string> = {
  'opus-5.5': 'Opus 5.5',
  'sonnet-5': 'Sonnet 5',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
};

const names: ResolveNames = {
  provider: (provider) => LABELS[provider] ?? provider,
  model: ({ model }) => MODELS[model] ?? model,
};

const base: Resolution = {
  slot: { kind: 'role', id: 'planner' },
  provider: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  source: 'auto',
  via: 'curated',
  skipped: [],
  shadowed: [],
  defaultProvider: 'codex',
  isBlockedByHidden: false,
};

describe('explainResolution', () => {
  it('says why a pin is skipped and what runs instead', () => {
    expect(
      explainResolution({
        names,
        resolution: {
          ...base,
          skipped: [
            { source: 'workspace', provider: 'anthropic', model: 'opus-5.5', reason: 'off' },
          ],
        },
      }),
    ).toBe('Pinned Opus 5.5 is skipped: Anthropic is Off. Using GPT-6.1 Sol.');
  });

  it.each([
    ['not-connected', 'Anthropic is not connected'],
    ['at-limit', 'Anthropic is at its limit'],
    ['hidden', 'Opus 5.5 is hidden'],
    ['cli-too-old', 'Anthropic needs a newer CLI for Opus 5.5'],
    ['unknown-model', 'Opus 5.5 is not available'],
    ['backup-idle', 'Anthropic is a backup'],
  ] as const)('names the %s reason', (reason, text) => {
    expect(
      explainResolution({
        names,
        resolution: {
          ...base,
          skipped: [{ source: 'project', provider: 'anthropic', model: 'opus-5.5', reason }],
        },
      }),
    ).toBe(`Pinned Opus 5.5 is skipped: ${text}. Using GPT-6.1 Sol.`);
  });

  it('names the project that overrides this value', () => {
    expect(
      explainResolution({
        names,
        resolution: {
          ...base,
          source: 'workspace',
          via: 'pin',
          shadowed: [
            {
              kind: 'project',
              name: 'payments-api',
              provider: 'anthropic',
              model: 'sonnet-5',
              effort: null,
            },
          ],
        },
      }),
    ).toBe('A project setting in payments-api overrides this: Sonnet 5.');
  });

  it('joins several projects in one sentence', () => {
    const shadow = (name: string) => ({
      kind: 'project' as const,
      name,
      provider: 'anthropic' as const,
      model: 'sonnet-5',
      effort: null,
    });

    expect(
      explainResolution({
        names,
        resolution: {
          ...base,
          source: 'workspace',
          shadowed: [shadow('payments-api'), shadow('ledger-core'), shadow('notify-relay')],
        },
      }),
    ).toBe('Project settings in payments-api, ledger-core and notify-relay override this.');
  });

  it('says why Auto picked a model when it passed a provider', () => {
    expect(
      explainResolution({
        names,
        resolution: {
          ...base,
          skipped: [{ source: 'auto', provider: 'anthropic', model: null, reason: 'at-limit' }],
        },
      }),
    ).toBe('Auto picks GPT-6.1 Sol: Anthropic is at its limit.');
  });

  it('says the default provider is why Auto picked a non-reference model', () => {
    expect(explainResolution({ names, resolution: base })).toBe(
      'Auto picks GPT-6.1 Sol: Codex is the default provider.',
    );
  });

  it('is silent when Auto simply runs the reference provider', () => {
    expect(
      explainResolution({
        names,
        resolution: {
          ...base,
          provider: 'anthropic',
          model: 'sonnet-5',
          defaultProvider: 'anthropic',
        },
      }),
    ).toBeNull();
  });

  it('is silent for a pin that runs', () => {
    expect(
      explainResolution({ names, resolution: { ...base, source: 'workspace', via: 'pin' } }),
    ).toBeNull();
  });
});
