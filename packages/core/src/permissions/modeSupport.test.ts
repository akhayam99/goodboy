import { describe, expect, it } from 'vitest';
import { CLAUDE_PERMISSION_MODES, PROVIDER_IDS } from '@goodboy/types';
import { MODE_STRICTNESS, modeSupportFor, resolveModeFor } from './modeSupport';

const CELLS = PROVIDER_IDS.flatMap((provider) =>
  CLAUDE_PERMISSION_MODES.map((mode) => ({ provider, mode })),
);

describe('modeSupportFor', () => {
  it.each(CELLS)('never runs $provider looser than $mode', ({ provider, mode }) => {
    const { runsAs } = modeSupportFor({ provider, mode });
    expect(MODE_STRICTNESS[runsAs]).toBeLessThanOrEqual(MODE_STRICTNESS[mode]);
  });

  it.each(CELLS)('gives a reason for every cell that is not plain works', ({ provider, mode }) => {
    const support = modeSupportFor({ provider, mode });
    if (support.support === 'works') {
      expect(support.reason).toBeNull();
      expect(support.runsAs).toBe(mode);
      return;
    }
    expect(support.reason).not.toBeNull();
  });

  it.each(CELLS)('only falls back when it runs a different mode', ({ provider, mode }) => {
    const support = modeSupportFor({ provider, mode });
    expect(support.support === 'fallback').toBe(support.runsAs !== mode);
  });

  it('runs every mode as asked on Claude', () => {
    for (const mode of CLAUDE_PERMISSION_MODES) {
      expect(resolveModeFor({ provider: 'anthropic', mode })).toBe(mode);
    }
  });

  it.each(['codex', 'gemini', 'cursor', 'opencode', 'openrouter', 'moonshot'] as const)(
    'turns ask first into read only on %s',
    (provider) => {
      expect(resolveModeFor({ provider, mode: 'default' })).toBe('plan');
      expect(modeSupportFor({ provider, mode: 'default' }).support).toBe('fallback');
    },
  );

  it('keeps full access on every provider', () => {
    for (const provider of PROVIDER_IDS) {
      expect(resolveModeFor({ provider, mode: 'bypassPermissions' })).toBe('bypassPermissions');
    }
  });

  it('keeps edits allowed where the CLI can scope edits', () => {
    expect(resolveModeFor({ provider: 'codex', mode: 'acceptEdits' })).toBe('acceptEdits');
    expect(resolveModeFor({ provider: 'gemini', mode: 'acceptEdits' })).toBe('acceptEdits');
    expect(resolveModeFor({ provider: 'cursor', mode: 'acceptEdits' })).toBe('plan');
    expect(resolveModeFor({ provider: 'opencode', mode: 'acceptEdits' })).toBe('plan');
  });
});
