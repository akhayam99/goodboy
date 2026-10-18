// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_FRAMES_SCENES } from './frames';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

describe('the frames scenes', () => {
  it('registers the four frame scenes', () => {
    expect(Object.keys(U24_FRAMES_SCENES).sort()).toEqual([
      'frames-chat-rail',
      'frames-guide-pinned',
      'frames-guide-rail',
      'frames-overview-rail-1920',
    ]);
  });

  it.each(['frames-guide-rail', 'frames-guide-pinned'] as const)(
    'draws the %s title first in the detail with Close in its header, beside the rail',
    async (id) => {
      const Scene = U24_FRAMES_SCENES[id];
      const { container } = render(
        <ToastProvider>
          <Scene />
        </ToastProvider>,
      );

      const title = await screen.findByRole('heading', { level: 1, name: 'What is Goodboy' });
      const detail = container.querySelector<HTMLElement>('[data-studio-detail]');
      expect(container.querySelector('[data-studio-band]')).toBeNull();
      expect(detail?.contains(title)).toBe(true);
      const header = title.closest('[data-slot="pane-header"]');
      expect(header?.contains(screen.getByRole('button', { name: 'Close guide' }))).toBe(true);
      expect(screen.getByRole('navigation', { name: 'Guide chapters' }).contains(title)).toBe(
        false,
      );
    },
  );
});
