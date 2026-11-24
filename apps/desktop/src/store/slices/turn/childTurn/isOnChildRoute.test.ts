// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isOnChildRoute } from './isOnChildRoute';

const CURSOR_ROUTE = { provider: 'cursor', model: 'sonnet-5.5' } as const;

describe('isOnChildRoute', () => {
  it('keeps a Cursor child on its route when the effort is in the model slug', () => {
    expect(
      isOnChildRoute({
        route: CURSOR_ROUTE,
        role: 'planner',
        override: { providerId: 'cursor', model: 'claude-sonnet-5-5-xhigh' },
      }),
    ).toBe(true);
  });

  it('keeps a Cursor child on its route at the default effort', () => {
    expect(
      isOnChildRoute({
        route: CURSOR_ROUTE,
        role: 'planner',
        override: { providerId: 'cursor', model: 'sonnet-5.5' },
      }),
    ).toBe(true);
  });

  it('keeps a child on its route when the pick names the model by its selection', () => {
    expect(
      isOnChildRoute({
        route: CURSOR_ROUTE,
        role: 'planner',
        override: { providerId: 'cursor', selection: { key: 'sonnet-5.5', effort: 'xhigh' } },
      }),
    ).toBe(true);
  });

  it('refuses another model on the same provider', () => {
    expect(
      isOnChildRoute({
        route: CURSOR_ROUTE,
        role: 'planner',
        override: { providerId: 'cursor', model: 'composer-2.5' },
      }),
    ).toBe(false);
  });

  it('refuses the same model on another provider', () => {
    expect(
      isOnChildRoute({
        route: CURSOR_ROUTE,
        role: 'planner',
        override: { providerId: 'anthropic', model: 'sonnet-5.5' },
      }),
    ).toBe(false);
  });

  it('refuses a pick that names no model', () => {
    expect(
      isOnChildRoute({ route: CURSOR_ROUTE, role: 'planner', override: { providerId: 'cursor' } }),
    ).toBe(false);
  });

  it('refuses a model this build does not know', () => {
    expect(
      isOnChildRoute({
        route: CURSOR_ROUTE,
        role: 'planner',
        override: { providerId: 'cursor', model: 'not-a-model' },
      }),
    ).toBe(false);
  });
});
