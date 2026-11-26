// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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

afterEach(cleanup);

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

  it('parks the chip under the right edge of the card under the pointer, off its text', () => {
    const zone = ZONES.find((candidate) => candidate.placement === 'merge');
    shown(viewOf({ hoverId: zone?.id ?? null, x: 500, y: 300 }));

    const chip = document.querySelector<HTMLElement>('[data-dock-chip]');
    const card = zone?.card;
    expect(chip?.style.left).toBe(`${(card?.x ?? 0) + (card?.width ?? 0)}px`);
    expect(chip?.className).not.toContain('-translate-y-full');
  });

  it('puts the chip above and left of the pointer while no card is under it', () => {
    shown(viewOf({ x: 500, y: 300 }));

    const chip = document.querySelector<HTMLElement>('[data-dock-chip]');
    expect(chip?.style.left).toBe('486px');
    expect(chip?.style.top).toBe('286px');
  });

  it('dims the page behind the cards', () => {
    shown(viewOf());

    expect(document.querySelector('[data-dock-dim]')).not.toBeNull();
  });

  it('shows one ghost of the landing slot and no fold chip when nothing folds', () => {
    shown(
      viewOf({
        hoverId: 'merge:terminal',
        ghost: { rect: { x: 0, y: 0, width: 400, height: 600 }, folds: [] },
      }),
    );

    expect(document.querySelectorAll('[data-dock-ghost]')).toHaveLength(1);
    expect(document.querySelector('[data-dock-fold]')).toBeNull();
  });

  it('shows a fold chip under the ghost only when something folds', () => {
    shown(
      viewOf({
        hoverId: 'merge:terminal',
        ghost: {
          rect: { x: 0, y: 0, width: 400, height: 500 },
          folds: [
            { key: 'monitoring', into: 'browser' },
            { key: 'scripts', into: 'browser' },
            { key: 'ask', into: 'browser' },
          ],
        },
      }),
    );

    expect(document.querySelector('[data-dock-fold]')?.textContent).toBe(
      'Folds Monitor, Scripts +1 more into Browser',
    );
  });

  it('adds the target name to Merge only on the hovered card', () => {
    shown(viewOf({ hoverId: 'merge:terminal' }));

    expect(screen.getByText('as a tab in Terminal')).toBeTruthy();
    expect(screen.queryByText('as a tab in Monitor')).toBeNull();
  });

  it('shrinks a band to a thin line until the pointer is in it', () => {
    shown(viewOf({ hoverId: 'above:terminal' }));

    const resting = document.querySelector<HTMLElement>('[data-dock-zone="below:terminal"]');
    const hovered = document.querySelector<HTMLElement>('[data-dock-zone="above:terminal"]');

    expect(resting?.style.height).toBe('14px');
    expect(hovered?.style.height).not.toBe('14px');
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
