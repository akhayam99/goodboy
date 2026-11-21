import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { DockDragStart } from '../dockDragContext';
import {
  dockDropZonesOf,
  type CanDropParams,
  type DockDropZone,
  type DockRect,
} from '../dockDropZonesOf';
import type { DockGridMove } from '../dockGridSpec';
import { dockZoneAt } from '../dockZoneAt';
import { SPLIT_DRAG_ATTRIBUTE } from '../splitDragAttribute';

export type DockDragView = {
  readonly key: string;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly zones: ReadonlyArray<DockDropZone>;
  readonly hoverId: string | null;
};

type Params = {
  readonly gridRef: RefObject<HTMLDivElement | null>;
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
  readonly canDrop: (params: CanDropParams) => boolean;
  readonly onMove: ((params: DockGridMove) => void) | null;
};

type Press = {
  readonly key: string;
  readonly startX: number;
  readonly startY: number;
  readonly isActive: boolean;
  readonly zones: ReadonlyArray<DockDropZone>;
  readonly title: string;
};

type StartParams = DockDragStart & {
  readonly key: string;
};

type PointParams = {
  readonly x: number;
  readonly y: number;
};

const DRAG_THRESHOLD_PX = 4;

const DRAG_AXIS = 'move';

type ElementParams = {
  readonly element: Element;
};

type KeyParams = {
  readonly key: string;
};

const rectOf = ({ element }: ElementParams): DockRect => {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top, width: box.width, height: box.height };
};

export const useDockDrag = ({ gridRef, columns, canDrop, onMove }: Params) => {
  const [view, setView] = useState<DockDragView | null>(null);
  const pressRef = useRef<Press | null>(null);
  const frameRef = useRef<number | null>(null);
  const latest = useRef({ columns, canDrop, onMove });
  latest.current = { columns, canDrop, onMove };
  const listeners = useRef<AbortController | null>(null);

  const finish = useCallback(() => {
    listeners.current?.abort();
    listeners.current = null;
    pressRef.current = null;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    document.body.removeAttribute(SPLIT_DRAG_ATTRIBUTE);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setView(null);
  }, []);

  useEffect(() => finish, [finish]);

  const zonesFor = ({ key }: KeyParams): ReadonlyArray<DockDropZone> => {
    const grid = gridRef.current;
    if (grid === null) {
      return [];
    }
    const panes = Array.from(grid.querySelectorAll<HTMLElement>('[data-dock-pane]')).map(
      (element) => ({ key: element.dataset.dockPane ?? '', rect: rectOf({ element }) }),
    );
    const page = grid.closest('aside')?.parentElement?.querySelector('[data-drawer-main]') ?? null;
    return dockDropZonesOf({
      dragKey: key,
      columns: latest.current.columns,
      panes,
      page: page === null ? null : rectOf({ element: page }),
      canDrop: latest.current.canDrop,
    });
  };

  const show = ({ x, y }: PointParams): void => {
    const press = pressRef.current;
    if (press === null) {
      return;
    }
    const hover = dockZoneAt({ zones: press.zones, x, y });
    setView({
      key: press.key,
      title: press.title,
      x,
      y,
      zones: press.zones,
      hoverId: hover?.id ?? null,
    });
  };

  const start = ({ key, event }: StartParams): void => {
    if (event.button !== 0 || latest.current.onMove === null) {
      return;
    }
    const grid = gridRef.current;
    const title =
      grid
        ?.querySelector(`[data-dock-pane="${CSS.escape(key)}"] section`)
        ?.getAttribute('aria-label') ?? key;
    pressRef.current = {
      key,
      startX: event.clientX,
      startY: event.clientY,
      isActive: false,
      zones: [],
      title,
    };
    listeners.current?.abort();
    const controller = new AbortController();
    listeners.current = controller;
    window.addEventListener(
      'pointermove',
      (move) => {
        const press = pressRef.current;
        if (press === null) {
          return;
        }
        if (!press.isActive) {
          const distance = Math.hypot(move.clientX - press.startX, move.clientY - press.startY);
          if (distance < DRAG_THRESHOLD_PX) {
            return;
          }
          pressRef.current = { ...press, isActive: true, zones: zonesFor({ key: press.key }) };
          document.body.setAttribute(SPLIT_DRAG_ATTRIBUTE, DRAG_AXIS);
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        }
        const point = { x: move.clientX, y: move.clientY };
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
        }
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;
          show(point);
        });
      },
      { signal: controller.signal },
    );
    window.addEventListener(
      'pointerup',
      (up) => {
        const press = pressRef.current;
        const zone =
          press === null || !press.isActive
            ? null
            : dockZoneAt({ zones: press.zones, x: up.clientX, y: up.clientY });
        finish();
        if (press !== null && zone !== null && zone.isValid) {
          latest.current.onMove?.({ key: press.key, target: zone.target });
        }
      },
      { signal: controller.signal },
    );
    window.addEventListener('pointercancel', finish, { signal: controller.signal });
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || pressRef.current?.isActive !== true) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        finish();
      },
      { signal: controller.signal, capture: true },
    );
  };

  return { view, start };
};
