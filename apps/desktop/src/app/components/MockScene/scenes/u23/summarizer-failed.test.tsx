// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U23_SUMMARIZER_FAILED_SCENES } from './summarizer-failed';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
  await import('../../../../../features/notifications/components/NotificationsStudio');
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  clearSceneInvoke();
});

describe('the summarizer failed scene', () => {
  it('names its scene', () => {
    expect(Object.keys(U23_SUMMARIZER_FAILED_SCENES)).toEqual(['summarizer-failed']);
  });

  it('shows one plain notice per kind once every model failed, with no raw cli line', async () => {
    const Scene = U23_SUMMARIZER_FAILED_SCENES['summarizer-failed'];
    if (Scene === undefined) {
      throw new Error('no summarizer-failed scene');
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(screen.getAllByText('Summarizer failed')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^Open all/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    expect(document.body.textContent).toContain('Cursor reached the usage limit for this account.');
    expect(document.body.textContent).toContain('Step summary unavailable');
    expect(document.body.textContent).toContain("Couldn't read the orchestrator's reply");
    expect(document.body.textContent).toContain('Orchestrated run blocked');
    expect(document.body.textContent).not.toContain('exited with code');
    expect(document.body.textContent).toContain('4m ago');
    expect(screen.queryByText('Older')).toBeNull();
  });
});
