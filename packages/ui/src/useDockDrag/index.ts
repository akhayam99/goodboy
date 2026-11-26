import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { DockDragStart } from '../dockDragContext';
import {
  createDockDragStore,
  type DockDragPosition,
  type DockDragStore,
  type DockDragView,
} from '../dockDragStore';
import {
  dockDropZonesOf,
  type CanDropParams,
  type DockDropZone,
  type DockRect,
} from '../dockDropZonesOf';
import type { DockGridColumnBox } from '../dockGridColumnBox';
import { dockFoldedOf, dockGhostOf, type DockGhost } from '../dockGhostOf';
import type { DockGridMove } from '../dockGridSpec';
import type { DockGroups } from '../dockLayoutAfterMove';
import type { DockMoveTarget, DockMoveUnit } from '../dockMoveTarget';
import { dockStatusOf } from '../dockStatusOf';
import { dockZoneAt } from '../dockZoneAt';
import { registerEscapeLayer } from '../escape';
import { SPLIT_DRAG_ATTRIBUTE } from '../splitDragAttribute';
import { useDockDragKeys, type DockDragKeys } from '../useDockDragKeys';

type Params = {
  readonly gridRef: RefObject<HTMLDivElement | null>;
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
  readonly groups: DockGroups;
  readonly boxes: ReadonlyArray<DockGridColumnBox>;
  readonly canDrop: (params: CanDropParams) => boolean;
  readonly boxesOf: (params: CanDropParams) => ReadonlyArray<DockGridColumnBox> | null;
  readonly onMove: ((params: DockGridMove) => void) | null;
};

type Press = {
  readonly key: string;
  readonly unit: DockMoveUnit;
  readonly pointerId: number | null;
  readonly startX: number;
  readonly startY: number;
  readonly isActive: boolean;
  readonly zones: ReadonlyArray<DockDropZone>;
  readonly names: Readonly<Record<string, string>>;
  readonly dock: DockRect | null;
  readonly title: string;
};

type StartParams = DockDragStart & {
  readonly key: string;
  readonly unit: DockMoveUnit;
};

type PointParams = {
  readonly x: number;
  readonly y: number;
};

type EventParams = {
  readonly event: PointerEvent;
};

type ShowParams = PointParams & {
  readonly isSwap: boolean;
};

type ElementParams = {
  readonly element: Element;
};

type IdParams = {
  readonly id: string;
};

type ViewParams = PointParams & {
  readonly hoverId: string | null;
  readonly isSwap: boolean;
  readonly position: DockDragPosition | null;
};

type DropParams = {
  readonly zone: DockDropZone | null;
  readonly isSwap: boolean;
};

type DockDrag = {
  readonly liftedKey: string | null;
  readonly liftedUnit: DockMoveUnit;
  readonly store: DockDragStore;
  readonly start: (params: StartParams) => void;
  readonly onKeyDown: DockDragKeys['onKeyDown'];
};

const DRAG_THRESHOLD_PX = 4;

const HOVER_INTENT_MS = 80;

const DRAG_AXIS = 'move';

const rectOf = ({ element }: ElementParams): DockRect => {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top, width: box.width, height: box.height };
};

export const useDockDrag = ({
  gridRef,
  columns,
  groups,
  boxes,
  canDrop,
  boxesOf,
  onMove,
}: Params): DockDrag => {
  const [store] = useState(createDockDragStore);
  const [lifted, setLifted] = useState<{ key: string; unit: DockMoveUnit } | null>(null);
  const pressRef = useRef<Press | null>(null);
  const frameRef = useRef<number | null>(null);
  const hoverRef = useRef<string | null>(null);
  const pendingRef = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const pointRef = useRef<PointParams>({ x: 0, y: 0 });
  const latest = useRef({ columns, groups, boxes, canDrop, boxesOf, onMove });
  latest.current = { columns, groups, boxes, canDrop, boxesOf, onMove };
  const listeners = useRef<AbortController | null>(null);
  const escapeRef = useRef<(() => void) | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const clearPending = useCallback(() => {
    if (pendingRef.current !== null) {
      clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    listeners.current?.abort();
    listeners.current = null;
    escapeRef.current?.();
    escapeRef.current = null;
    pressRef.current = null;
    hoverRef.current = null;
    clearPending();
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (restoreRef.current?.isConnected === true) {
      restoreRef.current.focus({ preventScroll: true });
    }
    restoreRef.current = null;
    store.set({ view: null });
    setLifted(null);
  }, [store, clearPending]);

  useEffect(() => finish, [finish]);

  const ghostOf = useCallback(({ zone, isSwap }: DropParams): DockGhost | null => {
    const press = pressRef.current;
    if (zone === null || press === null || press.dock === null) {
      return null;
    }
    const layout = isSwap && zone.swap !== null ? zone.swap : zone.layout;
    const moved = latest.current.boxesOf(layout);
    if (moved === null) {
      return null;
    }
    return dockGhostOf({
      boxes: moved,
      dock: press.dock,
      key: press.key,
      groups: layout.groups,
      was: dockFoldedOf({ boxes: latest.current.boxes, groups: latest.current.groups }),
    });
  }, []);

  const render = useCallback(
    ({ x, y, hoverId, isSwap, position }: ViewParams): void => {
      const press = pressRef.current;
      if (press === null) {
        return;
      }
      const zone = press.zones.find((candidate) => candidate.id === hoverId) ?? null;
      const before = store.get();
      const isSame =
        before !== null &&
        before.hoverId === (zone?.id ?? null) &&
        before.isSwap === isSwap &&
        before.position?.index === position?.index;
      const ghost = isSame ? before.ghost : ghostOf({ zone, isSwap });
      const view: DockDragView = {
        key: press.key,
        title: press.title,
        x,
        y,
        zones: press.zones,
        hoverId: zone?.id ?? null,
        names: press.names,
        ghost,
        isSwap,
        position,
        status: isSame
          ? before.status
          : dockStatusOf({
              zone,
              names: press.names,
              isSwap,
              folds: ghost?.folds ?? [],
              position,
            }),
      };
      hoverRef.current = view.hoverId;
      store.set({ view });
    },
    [ghostOf, store],
  );

  const dropOn = useCallback(
    ({ zone, isSwap }: DropParams): void => {
      const press = pressRef.current;
      finish();
      if (press === null || zone === null) {
        return;
      }
      const isSwapped = isSwap && zone.swap !== null && zone.paneKey !== null;
      latest.current.onMove?.({
        key: press.key,
        unit: isSwapped ? 'cell' : press.unit,
        target: isSwapped
          ? ({ at: 'swap', key: zone.paneKey ?? '' } satisfies DockMoveTarget)
          : zone.target,
      });
    },
    [finish],
  );

  const choose = useCallback(
    ({ id }: IdParams): void => {
      const press = pressRef.current;
      if (press === null) {
        return;
      }
      const index = press.zones.findIndex((zone) => zone.id === id);
      clearPending();
      render({
        ...pointRef.current,
        hoverId: id,
        isSwap: false,
        position: { index: index + 1, total: press.zones.length },
      });
    },
    [clearPending, render],
  );

  const keys = useDockDragKeys({
    store,
    onStep: choose,
    onDrop: ({ id }) =>
      dropOn({
        zone: pressRef.current?.zones.find((zone) => zone.id === id) ?? null,
        isSwap: false,
      }),
  });

  const start = useCallback(
    ({ key, unit, event }: StartParams): void => {
      if (event.button !== 0 || latest.current.onMove === null) {
        return;
      }
      const grid = gridRef.current;
      if (grid === null) {
        return;
      }
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        pointRef.current = { x: event.clientX, y: event.clientY };
      }
      const pointerId = typeof event.pointerId === 'number' ? event.pointerId : null;
      const paneElements = (): ReadonlyArray<HTMLElement> =>
        Array.from(grid.querySelectorAll<HTMLElement>('[data-dock-pane]'));
      const zonesOf = (): ReadonlyArray<DockDropZone> =>
        dockDropZonesOf({
          dragKey: key,
          unit,
          columns: latest.current.columns,
          groups: latest.current.groups,
          panes: paneElements().map((element) => ({
            key: element.dataset.dockPane ?? '',
            rect: rectOf({ element }),
          })),
          dock: rectOf({ element: grid }),
          canDrop: latest.current.canDrop,
        });
      const namesOf = (): Readonly<Record<string, string>> =>
        Object.fromEntries(
          [
            ...Array.from(grid.querySelectorAll<HTMLElement>('[data-dock-tab]')).map(
              (tab) => [tab.dataset.dockTab ?? '', tab.textContent ?? ''] as const,
            ),
            ...paneElements().map(
              (element) =>
                [
                  element.dataset.dockPane ?? '',
                  element.querySelector('section')?.getAttribute('aria-label') ?? '',
                ] as const,
            ),
          ].filter(([name, label]) => name !== '' && label !== ''),
        );
      const lead = Object.keys(latest.current.groups).find(
        (candidate) => latest.current.groups[candidate]?.includes(key) === true,
      );
      const group = lead === undefined ? [] : (latest.current.groups[lead] ?? []);
      const names = namesOf();
      pressRef.current = {
        key,
        unit,
        pointerId,
        startX: event.clientX,
        startY: event.clientY,
        isActive: false,
        zones: [],
        names,
        dock: null,
        title: unit === 'cell' && group.length > 1 ? `${group.length} panels` : (names[key] ?? key),
      };
      listeners.current?.abort();
      const controller = new AbortController();
      listeners.current = controller;
      const options = { signal: controller.signal, capture: true } as const;
      const isOther = ({ event: candidate }: EventParams): boolean =>
        pointerId !== null &&
        typeof candidate.pointerId === 'number' &&
        candidate.pointerId !== pointerId;
      const show = ({ x, y, isSwap }: ShowParams): void => {
        const press = pressRef.current;
        if (press === null) {
          return;
        }
        pointRef.current = { x, y };
        const hover = dockZoneAt({ zones: press.zones, x, y });
        const id = hover?.id ?? null;
        const current = hoverRef.current;
        if (id === current || id === null || current === null) {
          clearPending();
          render({ x, y, hoverId: id, isSwap, position: null });
          return;
        }
        if (pendingRef.current?.id !== id) {
          clearPending();
          pendingRef.current = {
            id,
            timer: setTimeout(() => {
              pendingRef.current = null;
              render({ ...pointRef.current, hoverId: id, isSwap, position: null });
            }, HOVER_INTENT_MS),
          };
        }
        render({ x, y, hoverId: current, isSwap, position: null });
      };
      window.addEventListener(
        'pointermove',
        (move) => {
          const press = pressRef.current;
          if (press === null || isOther({ event: move })) {
            return;
          }
          if (move.buttons === 0) {
            finish();
            return;
          }
          if (!press.isActive) {
            const distance = Math.hypot(move.clientX - press.startX, move.clientY - press.startY);
            if (distance < DRAG_THRESHOLD_PX) {
              return;
            }
            pressRef.current = {
              ...press,
              isActive: true,
              zones: zonesOf(),
              dock: rectOf({ element: grid }),
            };
            document.body.setAttribute(SPLIT_DRAG_ATTRIBUTE, DRAG_AXIS);
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            escapeRef.current = registerEscapeLayer(finish);
            restoreRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            grid.focus({ preventScroll: true });
            setLifted({ key, unit });
          }
          const point = { x: move.clientX, y: move.clientY, isSwap: move.altKey };
          if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
          }
          frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;
            show(point);
          });
        },
        options,
      );
      window.addEventListener(
        'pointerup',
        (up) => {
          if (isOther({ event: up })) {
            return;
          }
          const press = pressRef.current;
          const zone =
            press === null || !press.isActive
              ? null
              : dockZoneAt({ zones: press.zones, x: up.clientX, y: up.clientY });
          if (press !== null && press.isActive) {
            dropOn({ zone, isSwap: up.altKey });
            return;
          }
          finish();
        },
        options,
      );
      window.addEventListener(
        'pointercancel',
        (cancel) => {
          if (!isOther({ event: cancel })) {
            finish();
          }
        },
        options,
      );
      window.addEventListener('blur', finish, { signal: controller.signal });
    },
    [clearPending, dropOn, finish, gridRef, render],
  );

  return {
    liftedKey: lifted?.key ?? null,
    liftedUnit: lifted?.unit ?? 'cell',
    store,
    start,
    onKeyDown: keys.onKeyDown,
  };
};
