// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { focusFirstFlyoutRow } from './focusFirstFlyoutRow';

afterEach(() => {
  document.body.innerHTML = '';
});

const mountFlyouts = () => {
  document.body.innerHTML = `
    <div data-rail-flyout="session"><button id="session-row">Session row</button></div>
    <div data-rail-flyout="branches"><button id="branch-row">Branch row</button></div>
  `;
};

describe('focusFirstFlyoutRow', () => {
  it('focuses the first row of the flyout it is asked for, not an older one', () => {
    mountFlyouts();

    focusFirstFlyoutRow({ flyoutKey: 'branches' });

    expect(document.activeElement?.id).toBe('branch-row');
  });

  it('focuses the session flyout row when the session flyout is asked for', () => {
    mountFlyouts();

    focusFirstFlyoutRow({ flyoutKey: 'session' });

    expect(document.activeElement?.id).toBe('session-row');
  });

  it('leaves focus alone when that flyout is not open', () => {
    document.body.innerHTML =
      '<div data-rail-flyout="session"><button id="session-row">Row</button></div>';

    focusFirstFlyoutRow({ flyoutKey: 'branches' });

    expect(document.activeElement?.id).not.toBe('session-row');
  });
});
