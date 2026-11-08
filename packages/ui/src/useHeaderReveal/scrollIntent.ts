import { isNestedScroll } from './isNestedScroll';

const INTENT_MS = 500;
const SLACK_PX = 4;
const LINE_PX = 16;
const ARROW_PX = 120;

type Sign = -1 | 0 | 1;

type Grant = {
  readonly until: number;
  readonly budget: number;
  readonly sign: Sign;
};

type ViewportParams = {
  readonly viewport: HTMLElement;
};

type GrantParams = ViewportParams & {
  readonly sign: Sign;
  readonly budget: number;
};

type WheelParams = ViewportParams & {
  readonly event: WheelEvent;
};

type KeyParams = ViewportParams & {
  readonly event: KeyboardEvent;
};

type TouchParams = ViewportParams & {
  readonly event: TouchEvent;
};

type TouchMark = {
  readonly y: number;
  readonly sign: Sign;
};

type ClassifyParams = ViewportParams & {
  readonly delta: number;
};

export type ScrollIntent = {
  readonly onWheel: (params: WheelParams) => void;
  readonly onKey: (params: KeyParams) => void;
  readonly onTouchStart: (params: TouchParams) => void;
  readonly onTouchMove: (params: TouchParams) => void;
  readonly onTouchEnd: (params: ViewportParams) => void;
  readonly onTrackPress: (params: ViewportParams) => void;
  readonly hold: () => void;
  readonly forget: () => void;
  readonly isUserScroll: (params: ClassifyParams) => boolean;
};

type ValueParams = {
  readonly value: number;
};

type TargetParams = {
  readonly target: EventTarget | null;
};

const signOf = ({ value }: ValueParams): Sign => (value > 0 ? 1 : value < 0 ? -1 : 0);

const isEditable = ({ target }: TargetParams): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest('input, textarea, select, [role="textbox"]') !== null);

const isPressable = ({ target }: TargetParams): boolean =>
  target instanceof HTMLElement && target.closest('button, a, [role="button"]') !== null;

export const scrollIntent = (): ScrollIntent => {
  const grants = new Map<HTMLElement, Grant>();
  const touches = new Map<HTMLElement, TouchMark>();
  let isHeld = false;
  let holdVersion = 0;

  const grant = ({ viewport, sign, budget }: GrantParams) => {
    const now = performance.now();
    const live = grants.get(viewport);
    const carried =
      live !== undefined && live.until >= now && (live.sign === sign || sign === 0)
        ? live.budget
        : 0;
    grants.set(viewport, { until: now + INTENT_MS, budget: carried + budget, sign });
  };

  const onWheel = ({ viewport, event }: WheelParams) => {
    if (
      event.deltaY === 0 ||
      isNestedScroll({ target: event.target, viewport, deltaY: event.deltaY })
    ) {
      return;
    }
    const unit =
      event.deltaMode === 1 ? LINE_PX : event.deltaMode === 2 ? viewport.clientHeight : 1;
    grant({
      viewport,
      sign: signOf({ value: event.deltaY }),
      budget: Math.abs(event.deltaY) * unit,
    });
  };

  const onKey = ({ viewport, event }: KeyParams) => {
    if (isEditable({ target: event.target })) {
      return;
    }
    const page = viewport.clientHeight;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      grant({ viewport, sign: event.key === 'ArrowDown' ? 1 : -1, budget: ARROW_PX });
      return;
    }
    if (event.key === 'PageDown' || event.key === 'PageUp') {
      grant({ viewport, sign: event.key === 'PageDown' ? 1 : -1, budget: page });
      return;
    }
    if (event.key === ' ' && !isPressable({ target: event.target })) {
      grant({ viewport, sign: event.shiftKey ? -1 : 1, budget: page });
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      grant({
        viewport,
        sign: event.key === 'End' ? 1 : -1,
        budget: Number.POSITIVE_INFINITY,
      });
    }
  };

  const onTouchStart = ({ viewport, event }: TouchParams) => {
    const touch = event.touches[0];
    if (touch === undefined) {
      return;
    }
    touches.set(viewport, { y: touch.clientY, sign: 0 });
  };

  const onTouchMove = ({ viewport, event }: TouchParams) => {
    const touch = event.touches[0];
    const last = touches.get(viewport);
    if (touch === undefined || last === undefined) {
      return;
    }
    const deltaY = last.y - touch.clientY;
    if (deltaY === 0) {
      return;
    }
    const sign = signOf({ value: deltaY });
    touches.set(viewport, { y: touch.clientY, sign });
    if (isNestedScroll({ target: event.target, viewport, deltaY })) {
      return;
    }
    grant({ viewport, sign, budget: Math.abs(deltaY) });
  };

  const onTouchEnd = ({ viewport }: ViewportParams) => {
    const last = touches.get(viewport);
    touches.delete(viewport);
    if (last === undefined || last.sign === 0) {
      return;
    }
    grant({ viewport, sign: last.sign, budget: viewport.clientHeight });
  };

  const onTrackPress = ({ viewport }: ViewportParams) => {
    grant({ viewport, sign: 0, budget: viewport.clientHeight });
  };

  const hold = () => {
    grants.clear();
    holdVersion += 1;
    const version = holdVersion;
    isHeld = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (version === holdVersion) {
          isHeld = false;
        }
      }),
    );
  };

  const forget = () => {
    grants.clear();
    touches.clear();
  };

  const isUserScroll = ({ viewport, delta }: ClassifyParams): boolean => {
    if (isHeld || delta === 0) {
      return false;
    }
    const live = grants.get(viewport);
    if (live === undefined || live.until < performance.now()) {
      return false;
    }
    if (live.sign !== 0 && live.sign !== signOf({ value: delta })) {
      return false;
    }
    if (Math.abs(delta) > live.budget + SLACK_PX) {
      grants.delete(viewport);
      return false;
    }
    const budget = live.budget - Math.abs(delta);
    if (budget <= 0) {
      grants.delete(viewport);
      return true;
    }
    grants.set(viewport, { ...live, budget });
    return true;
  };

  return {
    onWheel,
    onKey,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTrackPress,
    hold,
    forget,
    isUserScroll,
  };
};
