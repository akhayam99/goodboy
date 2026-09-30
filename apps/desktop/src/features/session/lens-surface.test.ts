// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveLensSurface } from './lens-surface';

describe('resolveLensSurface', () => {
  it('sends a missing lens to the Overview', () => {
    expect(resolveLensSurface({ lens: null })).toBe('overview');
  });

  it('sends every context lens to the Overview, where the Context drawer opens', () => {
    expect(resolveLensSurface({ lens: 'context' })).toBe('overview');
    expect(resolveLensSurface({ lens: 'goal' })).toBe('overview');
    expect(resolveLensSurface({ lens: 'decisions' })).toBe('overview');
    expect(resolveLensSurface({ lens: 'last_output_summary' })).toBe('overview');
  });

  it('leaves every other lens on its own surface', () => {
    expect(resolveLensSurface({ lens: 'agents' })).toBe('agents');
    expect(resolveLensSurface({ lens: 'workflows' })).toBe('workflows');
  });
});
