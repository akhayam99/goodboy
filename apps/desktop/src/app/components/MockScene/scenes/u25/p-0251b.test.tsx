// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PANE_RHYTHM } from '@goodboy/ui';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_P_0251B_SCENES } from './p-0251b';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

describe('the u25 transcript width scene', () => {
  it('registers every scene by name', () => {
    for (const [name, scene] of Object.entries(U25_P_0251B_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(scene);
    }
  });

  it('lets an assistant paragraph fill the column and indents a user card by the shared gap', () => {
    const Scene = U25_P_0251B_SCENES['transcript-width'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const reply = screen.getByText(/The retry path in notify-relay posts the credit twice/);
    expect(reply.closest('[class*="--measure"]')).toBeNull();
    const userCard = screen
      .getByText(/Resume the Acme payments-api fix/)
      .closest(`[class*="${PANE_RHYTHM.message.user}"]`);
    expect(userCard).not.toBeNull();
  });

  it('fills a wide column with several turns, a code block and a question card', () => {
    const Scene = U25_P_0251B_SCENES['transcript-width'];
    const { container } = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    expect(
      screen.getByText(/The remote tip moved, so I am stopping before the push/),
    ).toBeDefined();
    expect(container.querySelector('pre')).not.toBeNull();
    expect(screen.getByText(/How do I proceed\?/)).toBeDefined();
    expect(container.textContent).not.toContain('ctx-question');
  });
});
