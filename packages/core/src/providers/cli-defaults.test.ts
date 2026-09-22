import { describe, expect, it } from 'vitest';
import { getMidModel } from './cli-defaults';
import { CURSOR_CATALOG } from './cursor/catalog';

describe('getMidModel', () => {
  it('skips cursor mid models that only spawn through Max Mode', () => {
    const chosen = getMidModel('cursor');
    expect(chosen).toBe('gemini-3.1-pro');
    const model = CURSOR_CATALOG.find((candidate) => candidate.key === chosen);
    expect(model?.combos.some((combo) => combo.maxMode === false)).toBe(true);
    const maxModeOnly = CURSOR_CATALOG.filter(
      (candidate) =>
        candidate.presentation.costTier === 'mid' &&
        candidate.combos.every((combo) => combo.maxMode),
    ).map((candidate) => candidate.key);
    expect(maxModeOnly).toContain('kimi-k3');
    expect(maxModeOnly).not.toContain(chosen);
  });

  it('keeps the codex mid model unchanged', () => {
    expect(getMidModel('codex')).toBe('gpt-5.6-terra');
  });
});
