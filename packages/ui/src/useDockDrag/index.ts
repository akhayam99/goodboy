import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { DockDragStart, DockLiftParams } from '../dockDragContext';
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
import { dockFoldedOf, dockGhostOf, type DockGhost, type DockGhostFold } from '../dockGhostOf';
import type { DockGridMove } from '../dockGridSpec';
import type { DockGroups } from '../dockLayoutAfterMove';
import type { DockMoveTarget, DockMoveUnit } from '../dockMoveTarget';
import { dockCardHonestOf } from '../dockCardHonestOf';
import { dockCardsClipOf } from '../dockCardsClipOf';
import { dockBoxShapeOf } from '../dockBoxShapeOf';
import { dockPaneElementsOf, dockPressOf, type DockPress } from '../dockPressOf';
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
  readonly onMove: ((params: DockGridMove) => void | Promise<boolean>) | null;
  readonly scope?: string;
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

type ActivateParams = {
  readonly grid: HTMLElement;
  readonly press: DockPress;
};

type NoteParams = {
  readonly text: string;
};

type LiftParams = DockLiftParams & {
  readonly unit: DockMoveUnit;
  readonly key: string;
};

type DockDrag = {
  readonly liftedKey: string | null;
  readonly liftedUnit: DockMoveUnit;
  readonly store: DockDragStore;
  readonly note: string;
  readonly start: (params: StartParams) => void;
  readonly lift: (params: LiftParams) => void;
  readonly onKeyDown: DockDragKeys['onKeyDown'];
};

const DRAG_THRESHOLD_PX = 4;

const HOVER_INTENT_MS = 80;

const DRAG_AXIS = 'move';

const NOTE_MS = 4000;

const rectOf = ({ element }: ElementParams): DockRect => {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top, width: box.width, height: box.height };
};

const headHeightOf = ({ element }: ElementParams): number => {
  const head = element.querySelector('[data-dock-panel-head]');
  return head === null
    ? 0
    : Math.max(0, head.getBoundingClientRect().bottom - element.getBoundingClientRect().top);
};

type FoldedByPaneParams = {
  readonly folded: ReadonlyArray<DockGhostFold>;
};

const foldedByPaneOf = ({ folded }: FoldedByPaneParams): Record<string, ReadonlyArray<string>> => {
  const byPane: Record<string, string[]> = {};
  folded.forEach((fold) => {
    byPane[fold.into] = [...(byPane[fold.into] ?? []), fold.key];
  });
  return byPane;
};

type MergeParams = {
  readonly zone: DockDropZone;
  readonly isSwap: boolean;
};

const isMerge = ({ zone, isSwap }: MergeParams): boolean =>
  zone.placement === 'merge' && !isSwap && zone.paneKey !== null;

type PaneRectParams = {
  readonly grid: HTMLElement | null;
  readonly key: string | null;
};

const paneRectOf = ({ grid, key }: PaneRectParams): DockRect | null => {
  if (grid === null || key === null) {
    return null;
  }
  const element = Array.from(grid.querySelectorAll<HTMLElement>('[data-dock-pane]')).find(
    (candidate) => candidate.dataset.dockPane === key,
  );
  return element === undefined ? null : rectOf({ element });
};

export const useDockDrag = ({
  gridRef,
  columns,
  groups,
  boxes,
  canDrop,
  boxesOf,
  onMove,
  scope,
}: Params): DockDrag => {
  const [store] = useState(createDockDragStore);
  const [lifted, setLifted] = useState<{ key: string; unit: DockMoveUnit } | null>(null);
  const [note, setNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressRef = useRef<DockPress | null>(null);
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

  const announce = useCallback(({ text }: NoteParams): void => {
    if (noteTimer.current !== null) {
      clearTimeout(noteTimer.current);
    }
    setNote(text);
    noteTimer.current = setTimeout(() => {
      noteTimer.current = null;
      setNote('');
    }, NOTE_MS);
  }, []);

  useEffect(
    () => () => {
      if (noteTimer.current !== null) {
        clearTimeout(noteTimer.current);
      }
    },
    [],
  );

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

  useEffect(() => {
    if (pressRef.current !== null) {
      finish();
    }
  }, [scope, finish]);

  const ghostOf = useCallback(
    ({ zone, isSwap }: DropParams): DockGhost | null => {
      const press = pressRef.current;
      if (zone === null || press === null || press.dock === null) {
        return null;
      }
      const layout = isSwap && zone.swap !== null ? zone.swap : zone.layout;
      const moved = latest.current.boxesOf(layout);
      if (moved === null) {
        return null;
      }
      const ghost = dockGhostOf({
        boxes: moved,
        dock: press.dock,
        key: press.key,
        groups: layout.groups,
        was: dockFoldedOf({ boxes: latest.current.boxes, groups: latest.current.groups }),
      });
      const target = isMerge({ zone, isSwap })
        ? paneRectOf({ grid: gridRef.current, key: zone.paneKey })
        : null;
      return target === null ? ghost : { ...ghost, rect: target };
    },
    [gridRef],
  );

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
      const folds = store.get()?.ghost?.folds;
      finish();
      if (press === null || zone === null) {
        return;
      }
      const isSwapped = isSwap && zone.swap !== null && zone.paneKey !== null;
      const moved = latest.current.onMove?.({
        key: press.key,
        unit: isSwapped ? 'cell' : press.unit,
        target: isSwapped
          ? ({ at: 'swap', key: zone.paneKey ?? '' } satisfies DockMoveTarget)
          : zone.target,
        ...(press.isKeyboard && { isKeyboard: true }),
      });
      if (!press.isKeyboard) {
        return;
      }
      const place = dockStatusOf({
        zone,
        names: press.names,
        isSwap,
        folds: folds ?? [],
        position: null,
      });
      void Promise.resolve(moved).then((isMoved) => {
        announce({
          text:
            isMoved === false ? `${press.title} did not move.` : `Moved ${press.title}. ${place}`,
        });
      });
    },
    [announce, finish, store],
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

  const activate = useCallback(
    ({ grid, press }: ActivateParams): void => {
      pressRef.current = {
        ...press,
        isActive: true,
        zones: dockCardsClipOf({
          zones: dockDropZonesOf({
            dragKey: press.key,
            unit: press.unit,
            columns: latest.current.columns,
            groups: latest.current.groups,
            panes: dockPaneElementsOf({ grid }).map((element) => ({
              key: element.dataset.dockPane ?? '',
              rect: rectOf({ element }),
              headHeight: headHeightOf({ element }),
            })),
            dock: rectOf({ element: grid }),
            folded: foldedByPaneOf({
              folded: dockFoldedOf({
                boxes: latest.current.boxes,
                groups: latest.current.groups,
              }),
            }),
            canDrop: latest.current.canDrop,
          }).filter((zone) => {
            const after = latest.current.boxesOf(zone.layout);
            return (
              after === null ||
              (dockBoxShapeOf({ boxes: after }) !==
                dockBoxShapeOf({ boxes: latest.current.boxes }) &&
                dockCardHonestOf({ zone, dragKey: press.key, boxes: after }))
            );
          }),
        }),
        dock: rectOf({ element: grid }),
      };
      document.body.setAttribute(SPLIT_DRAG_ATTRIBUTE, DRAG_AXIS);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      escapeRef.current = registerEscapeLayer(() => {
        const active = pressRef.current;
        if (active?.isKeyboard === true) {
          announce({ text: `Move of ${active.title} cancelled.` });
        }
        finish();
      });
      restoreRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      grid.focus({ preventScroll: true });
      setLifted({ key: press.key, unit: press.unit });
    },
    [announce, finish],
  );

  const lift = useCallback(
    ({ key, unit, element }: LiftParams): void => {
      const grid = gridRef.current;
      if (grid === null || latest.current.onMove === null || pressRef.current !== null) {
        return;
      }
      const box = rectOf({ element });
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const press = dockPressOf({
        grid,
        key,
        unit,
        groups: latest.current.groups,
        pointerId: null,
        x: point.x,
        y: point.y,
        isKeyboard: true,
      });
      activate({ grid, press });
      const active = (): DockPress | null => pressRef.current;
      if ((active()?.zones.length ?? 0) === 0) {
        finish();
        announce({ text: `There is no other place for ${press.title}.` });
        return;
      }
      pointRef.current = point;
      const controller = new AbortController();
      listeners.current = controller;
      document.addEventListener(
        'focusin',
        (event) => {
          if (!(event.target instanceof Node) || !grid.contains(event.target)) {
            announce({ text: `Move of ${press.title} cancelled.` });
            restoreRef.current = null;
            finish();
          }
        },
        { signal: controller.signal },
      );
      render({ ...point, hoverId: null, isSwap: false, position: null });
      announce({
        text: `${press.title} lifted. Arrow keys choose a place, Enter drops it, Escape cancels.`,
      });
    },
    [activate, announce, finish, gridRef, render],
  );

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
      pressRef.current = dockPressOf({
        grid,
        key,
        unit,
        groups: latest.current.groups,
        pointerId,
        x: event.clientX,
        y: event.clientY,
        isKeyboard: false,
      });
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
            activate({ grid, press });
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
    [activate, clearPending, dropOn, finish, gridRef, render],
  );

  return {
    liftedKey: lifted?.key ?? null,
    liftedUnit: lifted?.unit ?? 'cell',
    store,
    note,
    start,
    lift,
    onKeyDown: keys.onKeyDown,
  };
};
