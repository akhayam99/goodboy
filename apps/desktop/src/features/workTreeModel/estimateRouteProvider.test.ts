import { describe, expect, it } from 'vitest';
import { estimateKeyOf } from './agentWorkTime';
import { unknownEstimateBasis } from './estimateBasis';

const cursorKey = estimateKeyOf({
  role: 'scout',
  provider: 'cursor',
  model: 'gemini-3.1-pro',
  effort: 'medium',
  size: null,
});

describe('estimate route on a model two providers share', () => {
  it('does not clamp a Cursor effort against the Gemini effort axis', () => {
    expect(cursorKey.effort).not.toBe('low');
    expect(cursorKey.effort).not.toBe('high');
  });

  it('names the model the way Cursor does', () => {
    const text = unknownEstimateBasis({
      key: { ...cursorKey, effort: null },
      unit: 'turn',
    });

    expect(text).toContain('Gemini 3.1 Pro');
  });

  it('names it the Gemini way for a Gemini key', () => {
    const text = unknownEstimateBasis({
      key: { ...cursorKey, provider: 'gemini', effort: null },
      unit: 'turn',
    });

    expect(text).toContain('3.1 Pro');
    expect(text).not.toContain('Gemini 3.1 Pro');
  });
});
