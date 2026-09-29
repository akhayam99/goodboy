// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';

const { state } = vi.hoisted(() => ({ state: { active: 0 } }));

vi.mock('../../../../store', () => ({
  useAppStore: () => 'storefront-web',
  useRunningHere: () => state.active,
}));

vi.mock('../../linkedProjectsLabel', () => ({ linkedProjectsLabel: () => 'storefront-web' }));

import { CurrentWorkspaceRow } from './CurrentWorkspaceRow';

afterEach(cleanup);

const labelFor = (active: number): string => {
  state.active = active;
  render(<CurrentWorkspaceRow workspace={aWorkspace()} onOpenSettings={vi.fn()} />);
  return screen.getByText(/storefront-web ·/).textContent ?? '';
};

describe('CurrentWorkspaceRow', () => {
  it('counts sessions and calls waiting work active, not running', () => {
    expect(labelFor(0)).toBe('storefront-web · nothing active');
    cleanup();
    expect(labelFor(1)).toBe('storefront-web · 1 session active');
    cleanup();
    expect(labelFor(3)).toBe('storefront-web · 3 sessions active');
  });
});
