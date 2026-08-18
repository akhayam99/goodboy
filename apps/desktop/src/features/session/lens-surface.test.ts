import { describe, expect, it } from 'vitest';
import { contextRegionFor, resolveLensSurface } from './lens-surface';

describe('resolveLensSurface', () => {
  it('sends the goal lens to the Overview, the surface that renders it', () => {
    expect(resolveLensSurface({ lens: 'goal' })).toBe('overview');
  });

  it('sends a missing lens to the Overview', () => {
    expect(resolveLensSurface({ lens: null })).toBe('overview');
  });

  it('sends both context regions to the Context surface', () => {
    expect(resolveLensSurface({ lens: 'decisions' })).toBe('context');
    expect(resolveLensSurface({ lens: 'last_output_summary' })).toBe('context');
  });

  it('leaves every other lens on its own surface', () => {
    expect(resolveLensSurface({ lens: 'context' })).toBe('context');
    expect(resolveLensSurface({ lens: 'agents' })).toBe('agents');
    expect(resolveLensSurface({ lens: 'workflows' })).toBe('workflows');
  });
});

describe('contextRegionFor', () => {
  it('names the region to scroll to only for a region lens', () => {
    expect(contextRegionFor({ lens: 'decisions' })).toBe('decisions');
    expect(contextRegionFor({ lens: 'last_output_summary' })).toBe('last_output_summary');
    expect(contextRegionFor({ lens: 'context' })).toBeUndefined();
    expect(contextRegionFor({ lens: 'goal' })).toBeUndefined();
  });
});
