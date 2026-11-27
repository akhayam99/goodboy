// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MOCK_SCENES } from '../../../registry';
import { WINDOW_DOCK_DROPCHIPS_SCENES } from './dock-dropchips';

vi.mock('../../u49/DockPanelsScene', () => ({
  DockPanelsScene: ({ shape }: { readonly shape: string }) => <div data-testid={`dock-${shape}`} />,
}));

afterEach(cleanup);

describe('the dock drop pill scenes', () => {
  it('registers three scenes with the mock scene registry', () => {
    expect(Object.keys(WINDOW_DOCK_DROPCHIPS_SCENES)).toEqual([
      'dock-dropchips-merge',
      'dock-dropchips-below',
      'dock-dropchips-edge',
    ]);
    for (const name of Object.keys(WINDOW_DOCK_DROPCHIPS_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('ends a drag it started when the scene goes away', () => {
    const blur = vi.fn();
    window.addEventListener('blur', blur);
    const Scene = WINDOW_DOCK_DROPCHIPS_SCENES['dock-dropchips-merge'];
    const { unmount } = render(<Scene />);

    unmount();

    expect(blur).toHaveBeenCalledTimes(1);
    window.removeEventListener('blur', blur);
  });
});
