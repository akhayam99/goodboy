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

  it('side-signals-running keeps the running terminals off the column, they count on the right rail', async () => {
    await mount({ name: 'side-signals-running' });

    expect(screen.queryByRole('button', { name: /^Terminal/ })).toBeNull();
  });

  it.each(['side-tiles-dark', 'side-tiles-light'] as const)(
    '%s draws Monitoring as a quiet row with its count, and no tiles',
    async (name) => {
      await mount({ name });

      const row = screen.getByRole('button', { name: 'Monitoring, 3 in use' });
      expect(row.querySelector('[data-door-count]')?.textContent).toBe('3');
      expect(document.querySelector('[data-column-tile]')).toBeNull();
    },
  );

  it.each(['side-tiles-dark', 'side-tiles-light'] as const)(
    '%s shows the running terminals as a count on the Terminal rail button',
    async (name) => {
      await mount({ name });

      const tool = within(screen.getByRole('toolbar', { name: 'Tools' })).getByTestId(
        'pane-toggle-terminal',
      );
      expect(
        tool.closest('[data-slot="session-tool"]')?.querySelector('[data-testid="tool-count"]')
          ?.textContent,
      ).toBe('2');
    },
  );

  it('side-signals-idle shows nothing on the rows, only the Sessions dot for who needs you', async () => {
    await mount({ name: 'side-signals-idle' });

    expect(screen.getByRole('button', { name: 'Monitoring' }).textContent).toBe('Monitoring');
    expect(
      document.querySelector(
        '[data-column-door]:not([data-column-door="board"]) [data-door-signal]',
      ),
    ).toBeNull();
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount({ name });
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
