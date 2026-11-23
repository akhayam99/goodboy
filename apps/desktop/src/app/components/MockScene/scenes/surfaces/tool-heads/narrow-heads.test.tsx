// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../../..';
import { NARROW_HEADS_SCENES } from './narrow-heads';

const WAIT = { timeout: 15_000 };

type ObserverCallback = (
  entries: ReadonlyArray<{ readonly target: Element; readonly contentRect: { width: number } }>,
) => void;

type MountParams = {
  readonly id: string;
};

const stubPaneWidths = () => {
  class StubObserver {
    private readonly callback: ObserverCallback;

    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      const pane = target.closest('[data-narrow-pane]');
      const width = pane?.getAttribute('data-narrow-pane') === 'terminal' ? 268 : 348;
      this.callback([{ target, contentRect: { width } }]);
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  stubPaneWidths();
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
  vi.unstubAllGlobals();
});

const mount = ({ id }: MountParams) => {
  const Scene = NARROW_HEADS_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const paneOf = ({ id }: MountParams): HTMLElement => {
  const pane = document.querySelector<HTMLElement>(`[data-narrow-pane="${id}"]`);
  if (pane === null) {
    throw new Error(`no ${id} pane`);
  }
  return pane;
};

describe('the narrow tool head scenes', () => {
  it('registers the light and dark scenes', () => {
    expect(Object.keys(NARROW_HEADS_SCENES).sort()).toEqual([
      'tool-heads-narrow',
      'tool-heads-narrow-dark',
    ]);
    for (const [id, Scene] of Object.entries(NARROW_HEADS_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it.each(['tool-heads-narrow', 'tool-heads-narrow-dark'])(
    'keeps each narrow head to its title, More and Close (%s)',
    async (id) => {
      mount({ id });

      const terminalHead = await waitFor(() => {
        const head = paneOf({ id: 'terminal' }).querySelector<HTMLElement>(
          '[data-drawer-header-row]',
        );
        if (head === null) {
          throw new Error('The terminal draws no head yet.');
        }
        return head;
      }, WAIT);
      expect(terminalHead.hasAttribute('data-head-folded')).toBe(true);
      expect(within(terminalHead).queryByRole('button', { name: 'Open full page' })).toBeNull();
      within(terminalHead).getByRole('button', { name: /^More on / });
      within(terminalHead).getByRole('button', { name: 'Close' });

      const browser = paneOf({ id: 'browser' });
      await within(browser).findByRole('button', { name: /^Edit address/ }, WAIT);
      expect(browser.querySelector('[data-row-folded]')).not.toBeNull();
      expect(within(browser).queryByRole('button', { name: 'Console' })).toBeNull();
      within(browser).getByRole('button', { name: 'More' });
      within(browser).getByRole('button', { name: 'Close' });
      expect(screen.queryAllByRole('tooltip')).toHaveLength(0);
    },
  );
});
