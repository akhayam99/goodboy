// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { LOG_PAGE_ROWS } from '../../../../../features/session/central/log/logPageOf';
import { MOCK_SCENES } from '../..';
import { U47_BIG_SESSION_SCENES } from './big-session';
import { BIG_SESSION_AGENT_COUNT, BIG_SESSION_ID } from './bigSessionSeed';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U47_BIG_SESSION_SCENES;

type MountParams = {
  readonly name: SceneName;
};

let useAppStore: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async ({ name }: MountParams): Promise<HTMLElement> => {
  const Scene = U47_BIG_SESSION_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return screen.getByRole('region', { name: 'Log entries' });
};

const logRowCount = (): number => document.querySelectorAll('[data-log-row]').length;

describe('the u47 big session scenes', () => {
  it('registers both scenes', () => {
    for (const [name, Scene] of Object.entries(U47_BIG_SESSION_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
  });

  it('seeds a session of the size that froze the overview', async () => {
    await mount({ name: 'u47-big-session-overview' });

    const agents = useAppStore.getState().sessionPhaseRuns[BIG_SESSION_ID] ?? [];
    expect(agents.length).toBeGreaterThanOrEqual(BIG_SESSION_AGENT_COUNT);
  });

  it('draws one page of the log and offers the older rows', async () => {
    const log = await mount({ name: 'u47-big-session-log' });

    const older = within(log).getByRole('button', { name: `Show ${LOG_PAGE_ROWS} older rows` });

    expect(logRowCount()).toBe(LOG_PAGE_ROWS);
    expect(older.hasAttribute('disabled')).toBe(false);
  });

  it('draws the next page when the older rows are asked for', async () => {
    const log = await mount({ name: 'u47-big-session-log' });

    await act(async () => {
      fireEvent.click(
        within(log).getByRole('button', { name: `Show ${LOG_PAGE_ROWS} older rows` }),
      );
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(logRowCount()).toBe(LOG_PAGE_ROWS * 2);
  });
});
