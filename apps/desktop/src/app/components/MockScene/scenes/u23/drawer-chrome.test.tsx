// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U23_DRAWER_CHROME_SCENES } from './drawer-chrome';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const stubColumnWidth = (width: number) => {
  class StubObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      if (target.querySelector(':scope > [data-drawer-main]') !== null) {
        this.callback([{ contentRect: { width } }]);
      }
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

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
  vi.restoreAllMocks();
});

const WAIT = { timeout: 4_000 };

type SceneId = keyof typeof U23_DRAWER_CHROME_SCENES;

const renderScene = (id: SceneId) => {
  const Scene = U23_DRAWER_CHROME_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the drawer chrome scenes', () => {
  it('registers exactly the scenes the unit names, plus the overlay twin of the toast', () => {
    expect(Object.keys(U23_DRAWER_CHROME_SCENES).sort()).toEqual([
      'drawer-ask-draft',
      'drawer-headers',
      'floating-surfaces',
      'toast-over-drawer',
      'toast-over-drawer-overlay',
    ]);
  });

  it('ask draft: the composer holds the draft and has focus', async () => {
    stubColumnWidth(1440);
    renderScene('drawer-ask-draft');

    const composer = (await screen.findByRole(
      'textbox',
      { name: 'Ask about this session' },
      WAIT,
    )) as HTMLTextAreaElement;

    expect(composer.value).toBe('Which of these should I fix first, and what breaks if I skip it?');
    await waitFor(() => expect(document.activeElement).toBe(composer), WAIT);
    expect(screen.getByRole('region', { name: 'Ask' })).toBeDefined();
  });

  it('headers: Context in versions says Back to current, the others say Close', async () => {
    renderScene('drawer-headers');

    const context = await screen.findByRole('region', { name: 'Context' }, WAIT);
    expect(within(context).getByRole('button', { name: 'Back to current' })).toBeDefined();

    const diff = screen.getByRole('region', { name: 'Changes' });
    expect(within(diff).getByRole('button', { name: 'Close' })).toBeDefined();
    expect(within(diff).getByRole('button', { name: /Open in Files/ })).toBeDefined();

    const script = screen.getByRole('region', { name: 'test' });
    expect(within(script).getByRole('button', { name: 'Close' })).toBeDefined();
    expect(within(script).getByRole('button', { name: 'Run again' })).toBeDefined();
  });

  it('headers: the run button carries no native title and the long token stays whole', async () => {
    renderScene('drawer-headers');

    const script = await screen.findByRole('region', { name: 'test' }, WAIT);

    expect(within(script).getByRole('button', { name: 'Run again' }).hasAttribute('title')).toBe(
      false,
    );
    expect(within(script).getByText(/ENOENT: no such file/)).toBeDefined();
  });

  it('toast beside a push drawer: the stack stops at the card edge', async () => {
    stubColumnWidth(1440);
    const cardLeft = window.innerWidth - 480;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return { left: this.hasAttribute('data-drawer-card') ? cardLeft : 0, top: 0 } as DOMRect;
    });
    renderScene('toast-over-drawer');

    const toast = await screen.findByText('Fix run started', undefined, WAIT);
    const stack = toast.closest('[role="status"]')?.parentElement;

    expect(screen.getByRole('complementary', { name: 'Side panel' }).dataset['drawerMode']).toBe(
      'push',
    );
    await waitFor(() => expect(stack?.style.right).toBe('492px'), WAIT);
    expect(screen.getByRole('button', { name: 'Open run' })).toBeDefined();
  });

  it('toast over an overlay drawer: the stack stays at the right edge', async () => {
    stubColumnWidth(1000);
    renderScene('toast-over-drawer-overlay');

    const toast = await screen.findByText('Fix run started', undefined, WAIT);
    const stack = toast.closest('[role="status"]')?.parentElement;

    expect(screen.getByRole('complementary', { name: 'Side panel' }).dataset['drawerMode']).toBe(
      'overlay',
    );
    expect(stack?.style.right).toBe('');
  });

  it('floating surfaces: the switcher footer names two gestures', async () => {
    renderScene('floating-surfaces');

    const footer = (await screen.findByText('Release to open', undefined, WAIT)).parentElement;

    expect(footer?.children).toHaveLength(2);
    expect(screen.getByRole('menu', { name: 'Session actions' })).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Assignee' })).toBeDefined();
    expect(screen.getByRole('listbox', { name: 'Recent sessions' })).toBeDefined();
  });
});
