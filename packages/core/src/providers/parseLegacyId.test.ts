import { describe, expect, it } from 'vitest';
import { parseLegacyId } from './parseLegacyId';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';

describe('parseLegacyId', () => {
  it('maps shipped legacy ids to structured selections', () => {
    expect(parseLegacyId({ provider: 'anthropic', id: 'claude-sonnet-4-6' })).toEqual({
      key: 'sonnet-4.6',
    });
    expect(parseLegacyId({ provider: 'cursor', id: 'composer-2-fast' })).toEqual({
      key: 'composer-2.5',
      toggles: { thinking: false, fast: true },
    });
    expect(parseLegacyId({ provider: 'codex', id: 'gpt-5.6' })).toEqual({
      key: 'gpt-5.6',
      variant: 'sol',
    });
    expect(parseLegacyId({ provider: 'codex', id: 'gpt-5.3-codex-spark' })).toEqual({
      key: 'gpt-5.4-mini',
      variant: 'default',
    });
    expect(parseLegacyId({ provider: 'opencode', id: 'opencode/minimax-m3-free' })).toEqual({
      key: 'minimax-m2.5',
    });
  });

  it('returns null for an id that no old registry shipped', () => {
    expect(parseLegacyId({ provider: 'codex', id: 'gpt-99' })).toBeNull();
  });

  it('defaults and reports an unknown stored id', () => {
    expect(resolveStoredModelSelection({ provider: 'codex', id: 'gpt-99' })).toEqual({
      selection: { key: 'gpt-5.6', effort: 'low', variant: 'sol' },
      report: { kind: 'unknown', id: 'gpt-99' },
    });
  });
});
