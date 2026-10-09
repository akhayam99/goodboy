import { describe, expect, it } from 'vitest';
import { savedRouteEffort } from './savedRouteEffort';

describe('savedRouteEffort', () => {
  it('saves nothing for Auto', () => {
    expect(
      savedRouteEffort({
        route: { provider: '', model: '', effort: 'high' },
        requested: 'high',
        wasSaved: true,
      }),
    ).toBeNull();
  });

  it('saves nothing for a model with no effort ladder', () => {
    expect(
      savedRouteEffort({
        route: { provider: 'cursor', model: 'composer-2.5', effort: 'high' },
        requested: 'medium',
        wasSaved: true,
      }),
    ).toBeNull();
  });

  it('keeps an unset effort unset while the pick serves the requested one', () => {
    expect(
      savedRouteEffort({
        route: { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        requested: 'high',
        wasSaved: false,
      }),
    ).toBeNull();
  });

  it('saves the effort the pick serves once the requested one is not what runs', () => {
    expect(
      savedRouteEffort({
        route: { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        requested: 'max',
        wasSaved: false,
      }),
    ).toBe('high');
  });

  it('keeps writing a saved effort, clamped to the model', () => {
    expect(
      savedRouteEffort({
        route: { provider: 'anthropic', model: 'claude-sonnet-4-6', effort: 'max' },
        requested: 'max',
        wasSaved: true,
      }),
    ).toBe('high');
  });
});
