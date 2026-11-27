// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockDropZones } from '../components/DockDropZones';
import { createDockDragStore, type DockDragStore, type DockDragView } from '../dockDragStore';
import { DOCK_ZONE_LABELS, dockDropZonesOf } from '../dockDropZonesOf';

const PANES = [
  { key: 'terminal', rect: { x: 0, y: 0, width: 400, height: 600 } },
  { key: 'browser', rect: { x: 412, y: 0, width: 400, height: 600 } },
  { key: 'monitoring', rect: { x: 824, y: 0, width: 388, height: 600 } },
];

const ZONES = dockDropZonesOf({
  dragKey: 'browser',
  unit: 'cell',
  columns: [['terminal'], ['browser'], ['monitoring']],
  groups: {},
  panes: PANES,
  dock: { x: 0, y: 0, width: 1212, height: 600 },
  canDrop: () => true,
});

type ViewParams = Partial<DockDragView>;

const viewOf = (params: ViewParams = {}): DockDragView => ({
  key: 'browser',
  title: 'Browser',
  x: 500,
  y: 300,
  zones: ZONES,
  hoverId: null,
  names: { terminal: 'Terminal', browser: 'Browser', monitoring: 'Monitor', scripts: 'Scripts' },
  ghost: null,
  isSwap: false,
  position: null,
  status: 'Drop on a highlighted area, Esc to cancel.',
  ...params,
});

const shown = (view: DockDragView): DockDragStore => {
  const store = createDockDragStore();
  store.set({ view });
  render(<DockDropZones store={store} />);
  return store;
};

const widen = ({ width }: { readonly width: number }): void => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(width);
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the drag overlay', () => {
  it('writes the five fixed words and no others', () => {
    shown(viewOf());

    const labels = new Set(
      Array.from(document.querySelectorAll('[data-dock-zone-label]')).map((card) =>
        card.getAttribute('data-dock-zone-label'),
      ),
    );

    expect([...labels].sort()).toEqual(Object.values(DOCK_ZONE_LABELS).sort());
  });

  it('hides the pointer chip while a pill is hovered', () => {
    const zone = ZONES.find((candidate) => candidate.placement === 'merge');
    shown(viewOf({ hoverId: zone?.id ?? null, x: 500, y: 300 }));

    expect(document.querySelector('[data-dock-chip]')).toBeNull();
  });

  it('puts the pointer chip 18px right and 34px below the pointer while no pill is hovered', () => {
    widen({ width: 1400 });
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(900);
    shown(viewOf({ x: 500, y: 300 }));

    const chip = document.querySelector<HTMLElement>('[data-dock-chip]');
    expect(chip?.style.left).toBe('518px');
    expect(chip?.style.top).toBe('334px');
    expect(chip?.textContent).toBe('Browser');
  });

  it('flips the pointer chip to the left near the right edge', () => {
    widen({ width: 1400 });
    shown(viewOf({ x: 1360, y: 300 }));

    expect(document.querySelector('[data-dock-chip]')?.className).toContain('-translate-x-full');
  });

  it('raises the pointer chip above the pointer near the bottom edge', () => {
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(700);
    widen({ width: 1400 });
    shown(viewOf({ x: 500, y: 690 }));

    const chip = document.querySelector<HTMLElement>('[data-dock-chip]');
    expect(chip?.style.top).toBe('656px');
    expect(chip?.className).toContain('-translate-y-full');
  });

  it('draws no scrim and no dashed card', () => {
    shown(viewOf());

    expect(document.querySelector('[data-dock-dim]')).toBeNull();
    expect(document.querySelector('[class*="border-dashed"]')).toBeNull();
  });

  it('draws one outline inside the landing slot and no fold chip when nothing folds', () => {
    shown(
      viewOf({
        hoverId: 'merge:terminal',
        ghost: { rect: { x: 0, y: 0, width: 400, height: 600 }, folds: [] },
      }),
    );

    const ghost = document.querySelector<HTMLElement>('[data-dock-ghost]');
    expect(document.querySelectorAll('[data-dock-ghost]')).toHaveLength(1);
    expect(ghost?.style.left).toBe('5px');
    expect(ghost?.style.width).toBe('390px');
    expect(document.querySelector('[data-dock-fold]')).toBeNull();
  });

  it('puts the fold chip inside the outline, bottom centre, only for the hovered target', () => {
    const view = viewOf({
      hoverId: 'merge:terminal',
      ghost: {
        rect: { x: 0, y: 0, width: 400, height: 500 },
        folds: [
          { key: 'monitoring', into: 'browser' },
          { key: 'scripts', into: 'browser' },
          { key: 'ask', into: 'browser' },
        ],
      },
    });
    const store = shown(view);

    const fold = document.querySelector<HTMLElement>('[data-dock-fold]');
    expect(fold?.textContent).toBe('Folds Monitor, Scripts +1 more into Browser');
    expect(fold?.style.left).toBe('200px');
    expect(fold?.style.top).toBe('483px');

    act(() => {
      store.set({ view: { ...view, hoverId: null, ghost: null } });
    });

    expect(document.querySelector('[data-dock-fold]')).toBeNull();
  });

  it('keeps every pill off the ring of the outline', () => {
    const above = ZONES.find((candidate) => candidate.id === 'above:monitoring');
    shown(
      viewOf({
        hoverId: above?.id ?? null,
        ghost: { rect: { x: 824, y: 0, width: 388, height: 300 }, folds: [] },
      }),
    );

    const merge = document.querySelector<HTMLElement>('[data-dock-zone="merge:monitoring"]');
    const top = Number.parseFloat(merge?.style.top ?? '0');
    expect(top - 16).toBeGreaterThanOrEqual(295 + 6);
  });

  it('adds the target name to Merge only on the hovered pill', () => {
    shown(viewOf({ hoverId: 'merge:terminal' }));

    expect(screen.getByText('as a tab in Terminal')).toBeTruthy();
    expect(screen.queryByText('as a tab in Monitor')).toBeNull();
  });

  it('steps the other pills back while one is hovered', () => {
    shown(viewOf({ hoverId: 'merge:terminal' }));

    const resting = document.querySelector('[data-dock-zone="above:terminal"] > div');
    const hovered = document.querySelector('[data-dock-zone="merge:terminal"] > div');

    expect(resting?.className).toContain('opacity-55');
    expect(hovered?.className).not.toContain('opacity-55');
    expect(hovered?.className).toContain('bg-primary-solid');
  });

  it('keeps an above pill under the head of its panel', () => {
    const zones = dockDropZonesOf({
      dragKey: 'browser',
      unit: 'cell',
      columns: [['terminal'], ['browser']],
      groups: {},
      panes: [
        { key: 'terminal', rect: { x: 0, y: 0, width: 400, height: 600 }, headHeight: 44 },
        { key: 'browser', rect: { x: 412, y: 0, width: 400, height: 600 } },
      ],
      dock: { x: 0, y: 0, width: 812, height: 600 },
      canDrop: () => true,
    });

    const above = zones.find((zone) => zone.id === 'above:terminal');
    expect((above?.anchor.y ?? 0) - 16).toBeGreaterThanOrEqual(44);
  });

  it('reads the live line off the store and clears it off target', () => {
    const store = shown(
      viewOf({ hoverId: 'merge:terminal', status: 'Merge into Terminal as a tab' }),
    );
    expect(document.querySelector('[data-dock-status]')?.textContent).toBe(
      'Merge into Terminal as a tab',
    );

    act(() => {
      store.set({ view: viewOf({ hoverId: null }) });
    });

    expect(document.querySelector('[data-dock-status]')?.textContent).toBe(
      'Drop on a highlighted area, Esc to cancel.',
    );
  });

  it('has no fade of its own under reduced motion', () => {
    shown(viewOf({ hoverId: 'merge:terminal' }));

    const layer = document.querySelector('[data-dock-drop]');
    const classes = Array.from(layer?.querySelectorAll('[class]') ?? []).map(
      (element) => element.getAttribute('class') ?? '',
    );

    expect(
      classes.every(
        (value) =>
          value.split(/\s+/).filter((name) => /^(transition|duration|animate|ease)/.test(name))
            .length === 0,
      ),
    ).toBe(true);
  });

  it('draws nothing when no drag is running', () => {
    const store = createDockDragStore();
    render(<DockDropZones store={store} />);

    expect(document.querySelector('[data-dock-drop]')).toBeNull();
  });
});
