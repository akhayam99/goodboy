import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { DURATION_BASE_MS, canAnimate } from '@goodboy/ui';
import type { HomeWidgetId } from '../../grid/homeWidgets';
import { homeWidgetIdOf } from '../../layout/homeWidgetIdOf';
import { autoScrollSpeedOf } from '../../reorder/autoScrollSpeedOf';
import { dropTargetOf } from '../../reorder/dropTargetOf';
import { hasLeft, isSwapAllowed } from '../../reorder/isSwapAllowed';
import { motionEaseOf } from '../../reorder/motionEaseOf';
import { nearestInDirectionOf } from '../../reorder/nearestInDirectionOf';
import { orderAfterMove } from '../../reorder/orderAfterMove';
import { reorderMessageOf } from '../../reorder/reorderMessageOf';
import {
  DRAG_THRESHOLD_PX,
  type CellRect,
  type LastSwap,
  type Point,
} from '../../reorder/reorderTypes';

type DropParams = {
  readonly id: HomeWidgetId;
  readonly beforeId: HomeWidgetId | null;
};

type Params = {
  readonly gridRef: RefObject<HTMLDivElement | null>;
  readonly ids: ReadonlyArray<HomeWidgetId>;
  readonly isEnabled: boolean;
  readonly onDrop: (params: DropParams) => void;
};

type Session = {
  readonly id: HomeWidgetId;
  readonly ids: ReadonlyArray<HomeWidgetId>;
  readonly via: 'pointer' | 'keyboard';
};

type Candidate = {
  readonly id: HomeWidgetId;
  readonly x: number;
  readonly y: number;
  readonly pointerId: number;
};

type Settle = {
  readonly id: HomeWidgetId;
  readonly left: number;
  readonly top: number;
};

type PointerParams = {
  readonly id: HomeWidgetId;
  readonly event: ReactPointerEvent<HTMLElement>;
};

type KeyParams = {
  readonly id: HomeWidgetId;
  readonly event: ReactKeyboardEvent<HTMLElement>;
};

type WidgetReorder = {
  readonly liveIds: ReadonlyArray<HomeWidgetId>;
  readonly activeId: HomeWidgetId | null;
  readonly via: 'pointer' | 'keyboard' | null;
  readonly announcement: string;
  readonly onPointerDown: (params: PointerParams) => void;
  readonly onGripKeyDown: (params: KeyParams) => void;
};

type IdParams = {
  readonly id: HomeWidgetId;
};

const BLOCKED_TARGETS =
  '[data-widget-hide],[data-widget-resize],input,textarea,select,[contenteditable="true"]';

type GridParams = {
  readonly grid: HTMLElement;
};

type SlotParams = GridParams & {
  readonly id: HomeWidgetId;
};

type EndParams = {
  readonly isCommitted: boolean;
};

type EscapeParams = {
  readonly signal: AbortSignal;
};

type BeginParams = {
  readonly candidate: Candidate;
  readonly grid: HTMLDivElement;
};

type KeyOnlyParams = {
  readonly key: string;
};

const slotElementOf = ({ grid, id }: SlotParams) =>
  grid.querySelector<HTMLElement>(`[data-home-slot="${id}"]`);

const cellsOf = ({ grid }: GridParams): ReadonlyArray<CellRect> =>
  Array.from(grid.querySelectorAll<HTMLElement>('[data-home-cell]')).flatMap((cell) => {
    const id = homeWidgetIdOf({ value: cell.dataset.homeCell });
    return id === null ? [] : [{ id, rect: cell.getBoundingClientRect() }];
  });

const scrollerOf = ({ grid }: GridParams): HTMLElement | null => {
  let node = grid.parentElement;
  while (node !== null) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') {
      return node;
    }
    node = node.parentElement;
  }
  return null;
};

export const useWidgetReorder = ({ gridRef, ids, isEnabled, onDrop }: Params): WidgetReorder => {
  const [session, setSession] = useState<Session | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const sessionRef = useRef<Session | null>(null);
  const startIdsRef = useRef<ReadonlyArray<HomeWidgetId>>(ids);
  const candidateRef = useRef<Candidate | null>(null);
  const pointerRef = useRef<Point>({ x: 0, y: 0 });
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const lastSwapRef = useRef<LastSwap | null>(null);
  const frameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const settleRef = useRef<Settle | null>(null);
  const latestRef = useRef({ ids, onDrop, isEnabled });
  latestRef.current = { ids, onDrop, isEnabled };

  const place = useCallback((next: Session | null): void => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const lift = useCallback((): void => {
    const current = sessionRef.current;
    const grid = gridRef.current;
    if (current === null || grid === null || current.via !== 'pointer') {
      return;
    }
    const slot = slotElementOf({ grid, id: current.id });
    const cell = slot?.parentElement;
    if (slot == null || cell == null) {
      return;
    }
    const home = cell.getBoundingClientRect();
    const dx = pointerRef.current.x - offsetRef.current.x - home.left;
    const dy = pointerRef.current.y - offsetRef.current.y - home.top;
    slot.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  }, [gridRef]);

  const test = useCallback((): void => {
    const current = sessionRef.current;
    const grid = gridRef.current;
    if (current === null || grid === null || current.via !== 'pointer') {
      return;
    }
    const cells = cellsOf({ grid });
    const now = performance.now();
    const last = lastSwapRef.current;
    if (last !== null && !last.isExited) {
      const rect = cells.find((cell) => cell.id === last.targetId)?.rect;
      if (rect !== undefined && hasLeft({ rect, pointer: pointerRef.current })) {
        lastSwapRef.current = { ...last, isExited: true };
      }
    }
    const targetId = dropTargetOf({
      cells,
      ids: current.ids,
      draggedId: current.id,
      pointer: pointerRef.current,
      gridWidth: grid.getBoundingClientRect().width,
    });
    if (targetId === null || !isSwapAllowed({ last: lastSwapRef.current, targetId, now })) {
      return;
    }
    lastSwapRef.current = { targetId, at: now, isExited: false };
    place({
      ...current,
      ids: orderAfterMove({
        ids: current.ids,
        id: current.id,
        toIndex: current.ids.indexOf(targetId),
      }),
    });
  }, [gridRef, place]);

  const step = useCallback((): void => {
    lift();
    test();
    lift();
  }, [lift, test]);

  const scrollTick = useCallback((): void => {
    scrollFrameRef.current = null;
    const grid = gridRef.current;
    if (sessionRef.current?.via !== 'pointer' || grid === null) {
      return;
    }
    const scroller = scrollerOf({ grid });
    if (scroller === null) {
      return;
    }
    const box = scroller.getBoundingClientRect();
    const speed = autoScrollSpeedOf({
      pointerY: pointerRef.current.y,
      top: box.top,
      bottom: box.bottom,
    });
    if (speed === 0) {
      return;
    }
    scroller.scrollTop += speed;
    step();
    scrollFrameRef.current = requestAnimationFrame(scrollTick);
  }, [gridRef, step]);

  const settle = useCallback(
    ({ id }: IdParams): void => {
      const grid = gridRef.current;
      const slot = grid === null ? null : slotElementOf({ grid, id });
      if (slot === null) {
        return;
      }
      const visual = slot.getBoundingClientRect();
      settleRef.current = { id, left: visual.left, top: visual.top };
      slot.style.transform = '';
    },
    [gridRef],
  );

  const finish = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    candidateRef.current = null;
    lastSwapRef.current = null;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  const end = useCallback(
    ({ isCommitted }: EndParams): void => {
      const current = sessionRef.current;
      candidateRef.current = null;
      if (current === null) {
        finish();
        return;
      }
      const startIds = startIdsRef.current;
      const isChanged = current.ids.some((id, index) => id !== startIds[index]);
      if (current.via === 'pointer') {
        settle({ id: current.id });
      }
      finish();
      place(null);
      if (!isCommitted) {
        setAnnouncement(reorderMessageOf({ kind: 'cancel', id: current.id, ids: startIds }));
        return;
      }
      setAnnouncement(reorderMessageOf({ kind: 'drop', id: current.id, ids: current.ids }));
      if (isChanged) {
        const at = current.ids.indexOf(current.id);
        latestRef.current.onDrop({ id: current.id, beforeId: current.ids[at + 1] ?? null });
      }
    },
    [finish, place, settle],
  );

  const suppressClick = useCallback((): void => {
    const controller = new AbortController();
    window.addEventListener(
      'click',
      (event) => {
        event.stopPropagation();
        event.preventDefault();
        controller.abort();
      },
      { capture: true, signal: controller.signal },
    );
    setTimeout(() => controller.abort(), 0);
  }, []);

  const guardEscape = useCallback(
    ({ signal }: EscapeParams): void => {
      window.addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'Escape' || sessionRef.current === null) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          end({ isCommitted: false });
        },
        { capture: true, signal },
      );
      window.addEventListener('blur', () => end({ isCommitted: false }), { signal });
    },
    [end],
  );

  const begin = useCallback(
    ({ candidate, grid }: BeginParams) => {
      const slot = slotElementOf({ grid, id: candidate.id });
      if (slot === null) {
        candidateRef.current = null;
        finish();
        return;
      }
      const rect = slot.getBoundingClientRect();
      offsetRef.current = { x: candidate.x - rect.left, y: candidate.y - rect.top };
      startIdsRef.current = latestRef.current.ids;
      try {
        grid.setPointerCapture(candidate.pointerId);
      } catch {
        pointerRef.current = { x: candidate.x, y: candidate.y };
      }
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      place({ id: candidate.id, ids: latestRef.current.ids, via: 'pointer' });
      suppressClick();
    },
    [finish, place, suppressClick],
  );

  const onPointerDown = useCallback(
    ({ id, event }: PointerParams): void => {
      const grid = gridRef.current;
      const isBlocked =
        event.target instanceof Element && event.target.closest(BLOCKED_TARGETS) !== null;
      if (
        grid === null ||
        !latestRef.current.isEnabled ||
        sessionRef.current !== null ||
        candidateRef.current !== null ||
        event.button !== 0 ||
        event.pointerType === 'touch' ||
        isBlocked
      ) {
        return;
      }
      const candidate: Candidate = {
        id,
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      };
      candidateRef.current = candidate;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      guardEscape({ signal });
      window.addEventListener(
        'pointermove',
        (move) => {
          pointerRef.current = { x: move.clientX, y: move.clientY };
          if (sessionRef.current === null) {
            const start = candidateRef.current;
            if (
              start !== null &&
              Math.hypot(move.clientX - start.x, move.clientY - start.y) >= DRAG_THRESHOLD_PX
            ) {
              begin({ candidate: start, grid });
            }
          }
          if (sessionRef.current === null) {
            return;
          }
          if (frameRef.current === null) {
            frameRef.current = requestAnimationFrame(() => {
              frameRef.current = null;
              step();
            });
          }
          if (scrollFrameRef.current === null) {
            scrollFrameRef.current = requestAnimationFrame(scrollTick);
          }
        },
        { signal },
      );
      window.addEventListener('pointerup', () => end({ isCommitted: true }), { signal });
      window.addEventListener('pointercancel', () => end({ isCommitted: false }), { signal });
    },
    [begin, end, gridRef, guardEscape, scrollTick, step],
  );

  const moveKeyboard = useCallback(
    ({ key }: KeyOnlyParams): void => {
      const current = sessionRef.current;
      const grid = gridRef.current;
      if (current === null || grid === null) {
        return;
      }
      const index = current.ids.indexOf(current.id);
      const toIndex = (() => {
        switch (key) {
          case 'ArrowLeft':
            return index - 1;
          case 'ArrowRight':
            return index + 1;
          case 'Home':
            return 0;
          case 'End':
            return current.ids.length - 1;
          case 'ArrowUp':
          case 'ArrowDown': {
            const near = nearestInDirectionOf({
              cells: cellsOf({ grid }),
              id: current.id,
              direction: key === 'ArrowUp' ? 'up' : 'down',
            });
            return near === null ? index : current.ids.indexOf(near);
          }
          default:
            return index;
        }
      })();
      const clamped = Math.min(Math.max(toIndex, 0), current.ids.length - 1);
      if (clamped === index) {
        return;
      }
      const next = orderAfterMove({ ids: current.ids, id: current.id, toIndex: clamped });
      place({ ...current, ids: next });
      setAnnouncement(reorderMessageOf({ kind: 'move', id: current.id, ids: next }));
    },
    [gridRef, place],
  );

  const onGripKeyDown = useCallback(
    ({ id, event }: KeyParams): void => {
      if (event.key !== ' ' || !latestRef.current.isEnabled || sessionRef.current !== null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      startIdsRef.current = latestRef.current.ids;
      place({ id, ids: latestRef.current.ids, via: 'keyboard' });
      setAnnouncement(reorderMessageOf({ kind: 'grab', id, ids: latestRef.current.ids }));
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      guardEscape({ signal });
      window.addEventListener(
        'keydown',
        (key) => {
          if (key.key === 'Tab') {
            end({ isCommitted: true });
            return;
          }
          if (key.key === ' ' || key.key === 'Enter') {
            key.preventDefault();
            key.stopPropagation();
            end({ isCommitted: true });
            return;
          }
          if (key.key === 'Escape') {
            return;
          }
          key.preventDefault();
          key.stopPropagation();
          moveKeyboard({ key: key.key });
        },
        { capture: true, signal },
      );
      const keyup = new AbortController();
      window.addEventListener(
        'keyup',
        (key) => {
          if (key.key !== ' ') {
            return;
          }
          key.preventDefault();
          key.stopPropagation();
          if (sessionRef.current === null) {
            keyup.abort();
          }
        },
        { capture: true, signal: keyup.signal },
      );
    },
    [end, guardEscape, moveKeyboard, place],
  );

  useLayoutEffect(() => {
    if (session?.via === 'pointer') {
      lift();
    }
    if (session?.via === 'keyboard') {
      const grid = gridRef.current;
      const slot = grid === null ? null : slotElementOf({ grid, id: session.id });
      const grip = slot?.querySelector<HTMLElement>('[data-widget-grip]');
      if (grip != null && document.activeElement !== grip) {
        grip.focus();
      }
    }
  }, [session, gridRef, lift]);

  useLayoutEffect(() => {
    const pending = settleRef.current;
    const grid = gridRef.current;
    if (session !== null || pending === null || grid === null) {
      return;
    }
    settleRef.current = null;
    const slot = slotElementOf({ grid, id: pending.id });
    if (slot === null || typeof slot.animate !== 'function' || !canAnimate({ element: grid })) {
      return;
    }
    const home = slot.getBoundingClientRect();
    slot.animate(
      [
        { transform: `translate(${pending.left - home.left}px, ${pending.top - home.top}px)` },
        { transform: 'none' },
      ],
      { duration: DURATION_BASE_MS, easing: motionEaseOf({ token: '--ease-enter' }) },
    );
  }, [session, gridRef]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    },
    [],
  );

  return {
    liveIds: session === null ? ids : session.ids,
    activeId: session === null ? null : session.id,
    via: session === null ? null : session.via,
    announcement,
    onPointerDown,
    onGripKeyDown,
  };
};
