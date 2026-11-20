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
  readonly scene?: 'drawer-overlay-narrow' | 'drawer-wide-push' | 'panel-frame-detail-terminal';
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
  it('has no violation over the page, with no veil and the page still live', async () => {
    const container = await mount({ width: 800 });

    expect(
      screen.getByRole('complementary', { name: 'Side panel' }).getAttribute('data-drawer-mode'),
    ).toBe('overlay');
    expect(container.querySelector('[data-drawer-scrim]')).toBeNull();
    expect(container.querySelector('[data-drawer-main]')?.hasAttribute('inert')).toBe(false);
    await expectBaseline({ name: 'drawer over the page', container });
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

describe('a11y, a detail panel and the Terminal dock open together', () => {
  it('lays both over a narrow page with no veil, the page live, and has no violation', async () => {
    const container = await mount({ width: 900, scene: 'panel-frame-detail-terminal' });
    const aside = screen.getByRole('complementary', { name: 'Side panel' });

    expect(aside.getAttribute('data-drawer-mode')).toBe('overlay');
    expect(container.querySelectorAll('[data-drawer-scrim]')).toHaveLength(0);
    expect(container.querySelector('[data-drawer-main]')?.hasAttribute('inert')).toBe(false);
    expect(aside.querySelector('[data-detail-card]')?.hasAttribute('inert')).toBe(false);
    expect(aside.querySelector('[data-drawer-card]')?.hasAttribute('inert')).toBe(false);
    await expectBaseline({ name: 'detail and dock over the page', container });
  });

  it('pushes both beside a wide page with nothing inert, and has no violation', async () => {
    const container = await mount({ width: 1800, scene: 'panel-frame-detail-terminal' });

    expect(
      screen.getByRole('complementary', { name: 'Side panel' }).getAttribute('data-drawer-mode'),
    ).toBe('push');
    expect(container.querySelector('[data-drawer-scrim]')).toBeNull();
    expect(container.querySelector('[data-drawer-main]')?.hasAttribute('inert')).toBe(false);
    await expectBaseline({ name: 'detail and dock beside the page', container });
  });
});

describe('a11y, the plan document drawer beside the page', () => {
  it('pushes at the reader width of 720 plus the 12px gutter, the page kept beside it, no violation', async () => {
    const container = await mount({ width: 1440, scene: 'drawer-wide-push' });
    const aside = screen.getByRole('complementary', { name: 'Side panel' });

    expect(aside.getAttribute('data-drawer-sizing')).toBe('reader');
    expect(aside.getAttribute('data-drawer-mode')).toBe('push');
    expect(aside.style.width).toBe('732px');
    await expectBaseline({ name: 'drawer wide push', container });
  });
});
