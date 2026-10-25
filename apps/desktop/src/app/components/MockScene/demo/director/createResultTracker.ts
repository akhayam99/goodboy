import type { DemoRect } from './demoProtocol';

type Params = {
  readonly view: Window;
  readonly onChange: () => void;
};

export type ResultTracker = {
  readonly rects: () => ReadonlyArray<DemoRect>;
  readonly isOpen: () => boolean;
  readonly isHovered: () => boolean;
  readonly reset: () => void;
  readonly dispose: () => void;
};

type ElementParams = {
  readonly element: Element;
};

type PointParams = {
  readonly x: number;
  readonly y: number;
};

const COLLECT_MS = 450;
const MAX_CANDIDATES = 200;
const MAX_DESCENDANTS = 400;
const MIN_WIDTH = 48;
const MIN_HEIGHT = 24;
const MAX_SHARE = 0.6;
const COMPOSER = 'textarea[aria-label="Message to the agent"]';
const MIN_BUTTONS = 2;
const FOCUS_STEAL_MS = 3000;
const POINTER_ACTIVE_MS = 1500;

export const createResultTracker = ({ view, onChange }: Params): ResultTracker => {
  const root = view.document;
  const results = new Set<Element>();
  let candidates: Array<Element> = [];
  let clickTarget: Node | null = null;
  let clickedAt = 0;
  let collectUntil = 0;
  let settleTimer: number | null = null;
  let isPointerKnown = false;
  let pointer: PointParams = { x: 0, y: 0 };
  let wasHovered = false;
  let movedAt = 0;

  const boxOf = ({ element }: ElementParams): DOMRect => element.getBoundingClientRect();

  const isShown = ({ element }: ElementParams): boolean => {
    if (!element.isConnected) {
      return false;
    }
    const box = boxOf({ element });
    if (box.width < MIN_WIDTH || box.height < MIN_HEIGHT) {
      return false;
    }
    const style = view.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };

  const isTooBig = ({ element }: ElementParams): boolean => {
    const box = boxOf({ element });
    return box.width * box.height > view.innerWidth * view.innerHeight * MAX_SHARE;
  };

  const isAroundClick = ({ element }: ElementParams): boolean =>
    clickTarget !== null && element.contains(clickTarget);

  const shownPartsOf = ({ element }: ElementParams): ReadonlyArray<Element> => {
    if (isShown({ element })) {
      return [element];
    }
    return [...element.querySelectorAll('*')]
      .slice(0, MAX_DESCENDANTS)
      .filter((child) => isShown({ element: child }));
  };

  const settle = (): void => {
    settleTimer = null;
    const found = candidates
      .flatMap((element) => shownPartsOf({ element }))
      .filter((element) => !isTooBig({ element }) && !isAroundClick({ element }));
    candidates = [];
    for (const element of found) {
      const isNested = found.some((other) => other !== element && other.contains(element));
      if (!isNested) {
        results.add(element);
      }
    }
    onChange();
  };

  const observer = new MutationObserver((records) => {
    if (Date.now() > collectUntil) {
      return;
    }
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && candidates.length < MAX_CANDIDATES) {
          candidates.push(node);
        }
      }
    }
  });
  observer.observe(root.documentElement, { subtree: true, childList: true });

  const live = (): ReadonlyArray<Element> => {
    for (const element of [...results]) {
      if (!isShown({ element })) {
        results.delete(element);
      }
    }
    return [...results];
  };

  const isOverResult = (): boolean => {
    if (!isPointerKnown || Date.now() - movedAt > POINTER_ACTIVE_MS) {
      return false;
    }
    return live().some((element) => {
      const box = boxOf({ element });
      return (
        pointer.x >= box.left &&
        pointer.x <= box.right &&
        pointer.y >= box.top &&
        pointer.y <= box.bottom
      );
    });
  };

  const isInsideComposer = (target: Node | null): boolean => {
    const composer = root.querySelector(COMPOSER);
    if (composer === null || target === null) {
      return false;
    }
    let card: Element = composer;
    while (card.parentElement !== null && card.querySelectorAll('button').length < MIN_BUTTONS) {
      card = card.parentElement;
    }
    return card.contains(target);
  };

  const onPress = (event: Event): void => {
    if (!event.isTrusted || !(event.target instanceof Node)) {
      return;
    }
    const target = event.target;
    for (const element of [...results]) {
      if (!element.contains(target)) {
        results.delete(element);
      }
    }
    clickTarget = target;
    clickedAt = Date.now();
    if (clickedAt > collectUntil) {
      candidates = [];
    }
    collectUntil = clickedAt + COLLECT_MS;
    if (settleTimer !== null) {
      view.clearTimeout(settleTimer);
    }
    settleTimer = view.setTimeout(settle, COLLECT_MS);
    onChange();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!event.isTrusted) {
      return;
    }
    isPointerKnown = true;
    movedAt = Date.now();
    pointer = { x: event.clientX, y: event.clientY };
    const isHovered = isOverResult();
    if (isHovered !== wasHovered) {
      wasHovered = isHovered;
      onChange();
    }
  };

  const isStealing = ({ element }: ElementParams): boolean =>
    element.matches(COMPOSER) &&
    Date.now() - clickedAt <= FOCUS_STEAL_MS &&
    !isInsideComposer(clickTarget);

  const nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions): void {
    if (isStealing({ element: this })) {
      return;
    }
    nativeFocus.call(this, options);
  };

  view.addEventListener('pointerdown', onPress, { capture: true });
  view.addEventListener('click', onPress, { capture: true });
  view.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });

  return {
    rects: () =>
      live().flatMap((element) => {
        const box = boxOf({ element });
        const left = Math.max(0, box.left);
        const top = Math.max(0, box.top);
        const right = Math.min(view.innerWidth, box.right);
        const bottom = Math.min(view.innerHeight, box.bottom);
        if (right <= left || bottom <= top) {
          return [];
        }
        return [
          {
            x: Math.round(left),
            y: Math.round(top),
            width: Math.round(right - left),
            height: Math.round(bottom - top),
          },
        ];
      }),
    isOpen: () => live().length > 0,
    isHovered: () => isOverResult(),
    reset: () => {
      results.clear();
      candidates = [];
      clickTarget = null;
      wasHovered = false;
    },
    dispose: () => {
      observer.disconnect();
      if (settleTimer !== null) {
        view.clearTimeout(settleTimer);
      }
      view.removeEventListener('pointerdown', onPress, { capture: true });
      view.removeEventListener('click', onPress, { capture: true });
      view.removeEventListener('pointermove', onPointerMove, { capture: true });
      HTMLElement.prototype.focus = nativeFocus;
    },
  };
};
