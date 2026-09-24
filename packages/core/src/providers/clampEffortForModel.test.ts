import { describe, expect, it } from 'vitest';
import { clampEffortForModel, modelEffortLevels } from './clampEffortForModel';

describe('clampEffortForModel', () => {
  it('returns null for a model without an effort axis', () => {
    expect(clampEffortForModel({ model: 'composer-2.5', effort: 'high' })).toBeNull();
    expect(modelEffortLevels({ model: 'composer-2.5' })).toBeNull();
  });

  it('returns null for an unknown model', () => {
    expect(clampEffortForModel({ model: 'claude-vapor-9-9', effort: 'high' })).toBeNull();
  });

  it('keeps an effort the model supports', () => {
    expect(clampEffortForModel({ model: 'opus-5', effort: 'xhigh' })).toBe('xhigh');
  });

  it('clamps down to the nearest lower level', () => {
    expect(clampEffortForModel({ model: 'sonnet-4.6', effort: 'max' })).toBe('high');
  });

  it('clamps up when nothing lower exists', () => {
    expect(clampEffortForModel({ model: 'sonnet-4.6', effort: 'minimal' })).toBe('low');
  });

  it('reads the ladder through a native cli id', () => {
    expect(clampEffortForModel({ model: 'claude-sonnet-4-6', effort: 'max' })).toBe('high');
  });
});
