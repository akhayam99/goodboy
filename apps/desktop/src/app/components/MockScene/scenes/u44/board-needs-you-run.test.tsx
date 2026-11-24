// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { captureWindowLocation } from '../../../../../store/slices/navigation/captureWindowLocation';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U44_BOARD_NEEDS_YOU_SCENES } from './board-needs-you-run';

const SETTLE_MS = 2_000;

const NAMES = ['board-needs-you-run', 'board-needs-you-runs'] as const;

type SceneName = (typeof NAMES)[number];

let useAppStore: StoryStore;

beforeAll(async () => {
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

const mount = async (name: SceneName): Promise<HTMLElement> => {
  const Scene = U44_BOARD_NEEDS_YOU_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  const card = document.querySelector<HTMLElement>(
    '[data-needs-you-card="mock-board-session-notify-backoff"]',
  );
  if (card === null) {
    throw new Error('no needs you card for the waiting run');
  }
  return card;
};

describe('the Board needs you run scenes', () => {
  it('registers both scenes', () => {
    expect(Object.keys(U44_BOARD_NEEDS_YOU_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBeDefined();
    }
  });

  it('names the waiting session and its oldest wait on its Needs you card', async () => {
    const card = await mount('board-needs-you-run');

    expect(card.getAttribute('aria-label')).toBe(
      'Open Warn merchants before a payout hold, Should the warning go out by email, in the dashboard, or both?',
    );
  });

  it('keeps one card for a session with a second waiting run', async () => {
    await mount('board-needs-you-runs');

    expect(
      document.querySelectorAll('[data-needs-you-card="mock-board-session-notify-backoff"]'),
    ).toHaveLength(1);
  });

  it('opens the question the card names, the oldest wait of the session', async () => {
    const card = await mount('board-needs-you-run');

    await act(async () => {
      fireEvent.click(card);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(captureWindowLocation({ state: useAppStore.getState() }).place).toMatchObject({
      at: 'session',
      sessionId: 'mock-board-session-notify-backoff',
      view: { lens: 'questions', target: { kind: 'question' } },
    });
  });
});
