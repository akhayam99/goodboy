// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U30_POPOVERS_SCENES } from './popovers';
import { U30_TOOLTIPS_SCENES } from './tooltips';

const SETTLE_MS = 1_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

describe('the u30 edge scenes', () => {
  it('registers both scenes for the capture', () => {
    for (const [name, Scene] of Object.entries({
      ...U30_TOOLTIPS_SCENES,
      ...U30_POPOVERS_SCENES,
    })) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
  });

  it('u30-tooltips holds a label at every corner and on the cut row title', async () => {
    const Scene = U30_TOOLTIPS_SCENES['u30-tooltips'];
    render(<Scene />);
    await settle();

    const labels = screen.getAllByRole('tooltip').map((node) => node.textContent);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Top left corner, opens below',
        'Top right corner, opens below',
        'Bottom left corner, opens above',
        'Bottom right corner, opens above',
        'Right edge, opens to the left',
      ]),
    );
  });

  it('u30-popovers opens the model picker, Asks you, a menu and the composer suggestions', async () => {
    const Scene = U30_POPOVERS_SCENES['u30-popovers'];
    render(<Scene />);
    await settle();

    expect(screen.getAllByRole('dialog', { name: 'Model' })).toHaveLength(2);
    expect(screen.getAllByRole('dialog').length).toBeGreaterThanOrEqual(4);
    expect(document.querySelector('[data-context-menu]')).not.toBeNull();
    screen.getByText('Review the diff');
  });
});
