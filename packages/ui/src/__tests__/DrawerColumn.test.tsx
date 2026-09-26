// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  DRAWER_INSET,
  DrawerColumn,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  RIGHT_DRAWER_STORAGE_KEY,
  canDrawerPush,
} from '../components/DrawerColumn';

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

const renderColumn = (drawer: string | null) =>
  render(
    <DrawerColumn
      main={<div>main</div>}
      drawer={drawer === null ? null : <div>{drawer}</div>}
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DrawerColumn', () => {
  it('pushes the main column at 1440 wide, as a floating card with no shadow', () => {
    stubColumnWidth(1094);
    renderColumn('drafts');

    expect(panel().getAttribute('data-drawer-mode')).toBe('push');
    expect(panel().style.width).toBe(`${RIGHT_DRAWER_DEFAULT + DRAWER_INSET * 2}px`);
    const card = panel().querySelector('[data-drawer-card]');
    expect(card?.className).toContain('rounded-frame');
    expect(card?.className).toContain('bg-subtle');
    expect(card?.className).not.toContain('shadow');
  });

  it('lies over the main column at 1024 wide, with a shadow', () => {
    stubColumnWidth(678);
    renderColumn('drafts');

    expect(panel().getAttribute('data-drawer-mode')).toBe('overlay');
    expect(panel().className).toContain('absolute');
    expect(panel().querySelector('[data-drawer-card]')?.className).toContain('shadow-lg');
  });

  it('keeps a closed column empty, zero wide and inert', () => {
    stubColumnWidth(1094);
    renderColumn(null);

    expect(panel().getAttribute('data-drawer-mode')).toBe('closed');
    expect(panel().style.width).toBe('0px');
    expect(panel().hasAttribute('inert')).toBe(true);
  });

  it('pushes only when the main area keeps a 560px column beside the drawer', () => {
    expect(canDrawerPush({ mainWidthPx: 1166, drawerWidthPx: 400 })).toBe(true);
    expect(canDrawerPush({ mainWidthPx: 934, drawerWidthPx: 400 })).toBe(false);
  });

  it('shares one saved width, read back clamped to its range', () => {
    stubColumnWidth(2400);
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '900');
    renderColumn('drafts');

    expect(panel().style.width).toBe(`${RIGHT_DRAWER_MAX + DRAWER_INSET * 2}px`);
  });

  it('saves a resize under the one drawer key', () => {
    stubColumnWidth(2400);
    renderColumn('drafts');

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize side panel' }), {
      key: 'ArrowLeft',
    });

    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBe(String(RIGHT_DRAWER_DEFAULT + 8));
  });
});
