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
import { TURN_INTO_WORK_LABEL } from '../../../../../features/workspace-chat/components/TurnIntoWorkPanel';
import { U24_DRAWERS_CHAT_SCENES } from './drawers-chat';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const stubColumnWidth = (width: number) => {
  class StubObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback([{ contentRect: { width } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

describe('the Chat drawer split scene', () => {
  it('registers one scene', () => {
    expect(Object.keys(U24_DRAWERS_CHAT_SCENES)).toEqual(['drawer-split-chat']);
  });

  it('hosts the work panel in the chat studio sheet, closed until work starts', async () => {
    stubColumnWidth(1200);
    const Scene = U24_DRAWERS_CHAT_SCENES['drawer-split-chat'];
    const { container } = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const panel = await screen.findByRole('complementary', { name: TURN_INTO_WORK_LABEL });
    const slot = container.querySelector<HTMLElement>('[data-studio-slot="content"]');
    const page = slot?.querySelector<HTMLElement>('[data-container="page"]');

    expect(slot?.querySelector('[data-studio-sheet-owner]')).not.toBeNull();
    expect(panel.getAttribute('data-drawer-mode')).toBe('closed');
    expect(page?.getAttribute('data-sheet')).toBe('wrapped');
    expect(page?.querySelector('[data-studio-band]')).not.toBeNull();
    expect(page?.contains(panel)).toBe(false);
  });
});
