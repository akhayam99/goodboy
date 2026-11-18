// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_B_SIDE_SIGNALS_SCENES } from './b-side-signals';

const SETTLE_MS = 2_000;

const NAMES = [
  'side-signals-running',
  'side-signals-idle',
  'side-tiles-dark',
  'side-tiles-light',
] as const;

type SceneName = (typeof NAMES)[number];

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
  clearSceneInvoke();
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<Element> => {
  const Scene = U25_B_SIDE_SIGNALS_SCENES[name];
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the side column signal scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_B_SIDE_SIGNALS_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_B_SIDE_SIGNALS_SCENES[name]);
    }
  });

  it('side-signals-running keeps the running terminals off the places rail, they count on the right rail', async () => {
    await mount({ name: 'side-signals-running' });

    const places = screen.getByRole('navigation', { name: 'Places' });
    expect(within(places).queryByRole('button', { name: /^Terminal/ })).toBeNull();
  });

  it.each(['side-tiles-dark', 'side-tiles-light'] as const)(
    '%s numbers Monitoring with its ports in use on the tool rail, and no tiles',
    async (name) => {
      await mount({ name });

      const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
      const tool = within(toolbar).getByTestId('pane-toggle-monitoring');
      expect(tool.getAttribute('aria-label')).toBe('Monitoring, 3 in use');
      expect(
        tool.closest('[data-slot="tool-icon"]')?.querySelector('[data-testid="tool-count"]')
          ?.textContent,
      ).toBe('3');
      expect(document.querySelector('[data-column-tile]')).toBeNull();
    },
  );

  it.each(['side-tiles-dark', 'side-tiles-light'] as const)(
    '%s names the running terminals on the Terminal rail button and draws no number',
    async (name) => {
      await mount({ name });

      const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
      const tool = within(toolbar).getByTestId('pane-toggle-terminal');
      expect(tool.getAttribute('aria-label')).toBe('Terminal, 2 running');
      expect(toolbar.textContent).toBe('TerminalBrowserScriptsAsk3Monitor');
    },
  );

  it('side-signals-idle marks no place but the Board for who needs you', async () => {
    await mount({ name: 'side-signals-idle' });

    const places = screen.getByRole('navigation', { name: 'Places' });
    const marked = Array.from(places.querySelectorAll('[data-slot="shell-rail-item"]'))
      .filter((item) => (item.querySelector('[data-slot="rail-mark"]')?.childElementCount ?? 0) > 0)
      .map((item) =>
        item.querySelector('[data-shell-rail-item]')?.getAttribute('data-shell-rail-item'),
      );
    expect(marked.filter((id) => id !== 'board')).toEqual([]);
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount({ name });
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
