// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { CHROME_TITLE } from './chromeSeed';
import { U31_HEADER_SCENES } from './header';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = () => {
  const Scene = U31_HEADER_SCENES['u31-header'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const limitChip = async (): Promise<HTMLElement> => {
  const chips = await screen.findAllByRole('button', { name: /^Limit/ }, WAIT);
  const chip = chips[0];
  if (chip === undefined) {
    throw new Error('The limit setting did not render.');
  }
  return chip;
};

describe('the header scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U31_HEADER_SCENES)).toEqual(['u31-header']);
    expect(MOCK_SCENES['u31-header']).toBe(U31_HEADER_SCENES['u31-header']);
  });

  it('frames the capture on one element whose padding sits on an inner element', async () => {
    const { container } = mount();

    await limitChip();
    const frames = container.querySelectorAll<HTMLElement>('[data-shot]');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.style.width).toBe('680px');
    expect(frames[0]?.style.padding).toBe('');
    expect(frames[0]?.children).toHaveLength(1);
  });

  it('puts the title at level 1 and the settings in one grouped line', async () => {
    mount();

    await limitChip();
    screen.getByRole('heading', { level: 1, name: CHROME_TITLE });
    const line = screen.getByRole('group', { name: 'Run settings' });
    expect(within(line).getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('draws every setting as the quiet setting button with its chevron at rest', async () => {
    mount();

    const chip = await limitChip();
    expect(chip.getAttribute('data-variant')).toBe('setting');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.querySelector('[data-setting-chevron]')?.getAttribute('data-setting-chevron')).toBe(
      'rest',
    );
  });

  it('keeps the chevron shown while the popover is open and opens it from the keyboard', async () => {
    mount();

    const user = userEvent.setup();
    const chip = await limitChip();
    for (let step = 0; step < 60 && document.activeElement !== chip; step += 1) {
      await user.tab();
    }
    expect(document.activeElement).toBe(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('false');

    await user.keyboard('{Enter}');

    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(chip.querySelector('[data-setting-chevron]')?.getAttribute('data-setting-chevron')).toBe(
      'open',
    );
    await screen.findByRole('dialog', undefined, WAIT);
    await user.keyboard('{Escape}');
    expect(chip.getAttribute('aria-expanded')).toBe('false');

    await user.keyboard(' ');

    expect(chip.getAttribute('aria-expanded')).toBe('true');
    await screen.findByRole('dialog', undefined, WAIT);
  });
});
