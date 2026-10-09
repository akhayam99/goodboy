// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { expectBaseline } from './baseline';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';

const SCENE_SETTLE_MS = 10_000;

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const stubDrawerColumnWidth = (width: number) => {
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
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
});

const mount = async ({
  width,
  scene = 'drawer-overlay-narrow',
}: {
  readonly width: number;
  readonly scene?: 'drawer-overlay-narrow' | 'drawer-wide-push';
}) => {
  stubDrawerColumnWidth(width);
  const Scene = MOCK_SCENES[scene];
  if (Scene === undefined) {
    throw new Error(`${scene} is not a registered scene`);
  }
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SCENE_SETTLE_MS);
  });
  vi.useRealTimers();
  return container;
};

describe('a11y, the Ask drawer over the page', () => {
  it('has no violation with the scrim up and the page inert', async () => {
    const container = await mount({ width: 1000 });

    expect(
      screen.getByRole('complementary', { name: 'Side panel' }).getAttribute('data-drawer-mode'),
    ).toBe('overlay');
    expect(container.querySelector('[data-drawer-scrim]')).not.toBeNull();
    expect(container.querySelector('[data-drawer-main]')?.hasAttribute('inert')).toBe(true);
    await expectBaseline({ name: 'drawer overlay with scrim', container });
  });

  it('has no violation beside the page, where nothing is inert', async () => {
    const container = await mount({ width: 1440 });

    expect(
      screen.getByRole('complementary', { name: 'Side panel' }).getAttribute('data-drawer-mode'),
    ).toBe('push');
    expect(container.querySelector('[data-drawer-scrim]')).toBeNull();
    await expectBaseline({ name: 'drawer pushing the page', container });
  });
});

describe('a11y, the plan document drawer beside the page', () => {
  it('pushes at 560 with the page kept beside it, and has no violation', async () => {
    const container = await mount({ width: 1440, scene: 'drawer-wide-push' });
    const aside = screen.getByRole('complementary', { name: 'Side panel' });

    expect(aside.getAttribute('data-drawer-sizing')).toBe('half');
    expect(aside.getAttribute('data-drawer-mode')).toBe('push');
    expect(aside.style.width).toBe('576px');
    await expectBaseline({ name: 'drawer wide push', container });
  });
});
