// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { U25_HISTORY_FIXES_SCENES } from './history-fixes';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('the u25 history fixes scenes', () => {
  it('registers the next step rebase scene', () => {
    expect(Object.keys(U25_HISTORY_FIXES_SCENES)).toEqual(['next-step-rebase']);
  });

  it('offers Rebase and Not now while idle', () => {
    const Scene = U25_HISTORY_FIXES_SCENES['next-step-rebase'];
    render(<Scene />);

    expect(screen.getByRole('button', { name: 'Rebase' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeDefined();
  });

  it('keeps only the busy Rebasing button while the rebase runs', () => {
    window.history.replaceState(null, '', '/?state=busy');
    const Scene = U25_HISTORY_FIXES_SCENES['next-step-rebase'];
    render(<Scene />);

    expect(screen.getByRole('button', { name: 'Rebasing' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });
});
