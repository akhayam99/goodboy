import { describe, expect, it } from 'vitest';
import { ARTIFACT_BRIEF_LIMITS, clipBrief } from './artifactBrief';

describe('clipBrief', () => {
  it('clips a brief at the bound and says so', () => {
    const result = clipBrief({ text: 'x'.repeat(ARTIFACT_BRIEF_LIMITS.chars + 40) });
    expect(result.isClipped).toBe(true);
    expect(result.text).toHaveLength(ARTIFACT_BRIEF_LIMITS.chars);
  });

  it('leaves a brief at the bound untouched', () => {
    const text = 'y'.repeat(ARTIFACT_BRIEF_LIMITS.chars);
    const result = clipBrief({ text });
    expect(result.isClipped).toBe(false);
    expect(result.text).toBe(text);
  });

  it('trims surrounding whitespace before measuring', () => {
    const result = clipBrief({ text: '  redraw the settlement review flow  ' });
    expect(result.text).toBe('redraw the settlement review flow');
  });
});
