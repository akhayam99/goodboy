// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveLensSurface } from './lens-surface';

describe('resolveLensSurface', () => {
  it('sends a missing lens to the Overview', () => {
    expect(resolveLensSurface({ lens: null })).toBe('overview');
  });

  it('leaves every other lens on its own surface', () => {
    expect(resolveLensSurface({ lens: 'questions' })).toBe('questions');
    expect(resolveLensSurface({ lens: 'workflows' })).toBe('workflows');
  });
});
