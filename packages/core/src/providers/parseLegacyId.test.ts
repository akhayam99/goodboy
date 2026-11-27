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

  it('recognizes the stored GPT-6.1 Sol cli id', () => {
    expect(
      resolveStoredModelSelection({ provider: 'codex', id: 'gpt-6.1-sol', effort: 'high' }),
    ).toEqual({
      selection: { key: 'gpt-6.1-sol', effort: 'high' },
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
      key: 'gpt-5.6-sol',
    });
    expect(parseLegacyId({ provider: 'codex', id: 'gpt-5.3-codex-spark' })).toEqual({
      key: 'gpt-5.6-luna',
    });
    expect(parseLegacyId({ provider: 'opencode', id: 'opencode/minimax-m3-free' })).toEqual({
      key: 'big-pickle',
    });
  });

  it('migrates retired opencode catalog keys persisted as bare ids to Big Pickle', () => {
    for (const id of ['minimax-m2.5', 'nemotron-3-super', 'ring-2.6-1t', 'muse-spark-1.2']) {
      expect(parseLegacyId({ provider: 'opencode', id })).toEqual({ key: 'big-pickle' });
      expect(resolveStoredModelSelection({ provider: 'opencode', id })).toEqual({
        selection: { key: 'big-pickle' },
        report: { kind: 'legacy', id },
      });
    }
  });

  it('moves the retired MiMo V2.5 onto the MiMo V2.6 Flash that Zen lists now', () => {
    for (const id of ['mimo-v2.5', 'opencode/mimo-v2.5-free']) {
      expect(parseLegacyId({ provider: 'opencode', id })).toEqual({ key: 'mimo-v2.6-flash' });
    }
    expect(
      parseLegacyId({ provider: 'opencode', id: 'opencode/muse-spark-1.2-contributor-free' }),
    ).toEqual({ key: 'big-pickle' });
  });

  it.each(['gemini-3.8-flash', 'gemini-3.5-flash'])(
    'moves a saved %s pick to the model every Google plan runs',
    (id) => {
      expect(parseLegacyId({ provider: 'gemini', id })).toEqual({ key: 'gemini-4-hydrogen' });
      expect(resolveStoredModelSelection({ provider: 'gemini', id })).toEqual({
        selection: { key: 'gemini-4-hydrogen' },
        report: { kind: 'legacy', id },
      });
      expect(resolveStoredModelSelection({ provider: 'gemini', id, effort: 'low' })).toEqual({
        selection: { key: 'gemini-4-hydrogen', effort: 'low' },
        report: { kind: 'legacy', id },
      });
    },
  );

  it('degrades the codex ids the cli now rejects onto their live price peers', () => {
    for (const id of ['gpt-5.4', 'gpt-5.2', 'gpt-5.3-codex']) {
      expect(parseLegacyId({ provider: 'codex', id })).toEqual({ key: 'gpt-5.6-terra' });
      expect(resolveStoredModelSelection({ provider: 'codex', id })).toEqual({
        selection: { key: 'gpt-5.6-terra' },
        report: { kind: 'legacy', id },
      });
    }
    for (const id of ['gpt-5.4-mini', 'gpt-5.3-codex-spark']) {
      expect(parseLegacyId({ provider: 'codex', id })).toEqual({ key: 'gpt-5.6-luna' });
      expect(resolveStoredModelSelection({ provider: 'codex', id })).toEqual({
        selection: { key: 'gpt-5.6-luna' },
        report: { kind: 'legacy', id },
      });
    }
  });

  it('degrades the openrouter ids the api no longer lists onto their live replacements', () => {
    const cases = [
      { id: 'openrouter/google/gemini-3.1-pro', key: 'gemini-3.1-pro' },
      { id: 'openrouter/deepseek/deepseek-v4', key: 'deepseek-v4-pro' },
      { id: 'deepseek-v4', key: 'deepseek-v4-pro' },
      { id: 'openrouter/x-ai/grok-4', key: 'grok-4.7' },
      { id: 'grok-4', key: 'grok-4.7' },
    ];
    for (const { id, key } of cases) {
      expect(parseLegacyId({ provider: 'openrouter', id })).toEqual({ key });
      expect(resolveStoredModelSelection({ provider: 'openrouter', id })).toEqual({
        selection: { key },
        report: { kind: 'legacy', id },
      });
    }
  });

  it('returns null for an id that no old registry shipped', () => {
    expect(parseLegacyId({ provider: 'codex', id: 'gpt-99' })).toBeNull();
  });

  it('defaults and reports an unknown stored id', () => {
    expect(resolveStoredModelSelection({ provider: 'codex', id: 'gpt-99' })).toEqual({
      selection: { key: 'gpt-6.2-sol', effort: 'low', variant: 'default' },
      report: { kind: 'unknown', id: 'gpt-99' },
    });
  });
});
