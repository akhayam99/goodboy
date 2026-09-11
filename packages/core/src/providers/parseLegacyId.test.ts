import { describe, expect, it } from 'vitest';
import { parseLegacyId } from './parseLegacyId';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';

describe('parseLegacyId', () => {
  it('maps the bare Astra family id with its requested effort', () => {
    expect(parseLegacyId({ provider: 'codex', id: 'gpt-6', effort: 'max' })).toEqual({
      key: 'gpt-6',
      variant: 'astra',
      effort: 'max',
    });
  });

  it('recognizes stored Astra cli ids without falling back to Sol', () => {
    expect(
      resolveStoredModelSelection({ provider: 'codex', id: 'gpt-6-astra', effort: 'max' }),
    ).toEqual({
      selection: { key: 'gpt-6', variant: 'astra', effort: 'max' },
      report: null,
    });
  });

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
      key: 'big-pickle',
    });
  });

  it('migrates retired opencode catalog keys persisted as bare ids to Big Pickle', () => {
    for (const id of ['minimax-m2.5', 'nemotron-3-super', 'ring-2.6-1t']) {
      expect(parseLegacyId({ provider: 'opencode', id })).toEqual({ key: 'big-pickle' });
      expect(resolveStoredModelSelection({ provider: 'opencode', id })).toEqual({
        selection: { key: 'big-pickle' },
        report: { kind: 'legacy', id },
      });
    }
  });

  it('degrades the retired gemini flash id to the model that replaced it', () => {
    expect(parseLegacyId({ provider: 'gemini', id: 'gemini-3.5-flash' })).toEqual({
      key: 'gemini-3.8-flash',
    });
    expect(resolveStoredModelSelection({ provider: 'gemini', id: 'gemini-3.5-flash' })).toEqual({
      selection: { key: 'gemini-3.8-flash' },
      report: { kind: 'legacy', id: 'gemini-3.5-flash' },
    });
    expect(
      resolveStoredModelSelection({ provider: 'gemini', id: 'gemini-3.5-flash', effort: 'low' }),
    ).toEqual({
      selection: { key: 'gemini-3.8-flash', effort: 'low' },
      report: { kind: 'legacy', id: 'gemini-3.5-flash' },
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
