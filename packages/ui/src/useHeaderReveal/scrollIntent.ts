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

type ClassifyParams = ViewportParams & {
  readonly delta: number;
};

export type ScrollIntent = {
  readonly onWheel: (params: WheelParams) => void;
  readonly onKey: (params: KeyParams) => void;
  readonly onTouch: (params: ViewportParams) => void;
  readonly onDragStart: (params: ViewportParams) => void;
  readonly onDragEnd: () => void;
  readonly hold: () => void;
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
  let dragged: HTMLElement | null = null;
  let heldUntilFrame = false;

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

  const onTouch = ({ viewport }: ViewportParams) => {
    grant({ viewport, sign: 0, budget: Number.POSITIVE_INFINITY });
  };

  const onDragStart = ({ viewport }: ViewportParams) => {
    dragged = viewport;
  };

  const onDragEnd = () => {
    if (dragged === null) {
      return;
    }
    grant({ viewport: dragged, sign: 0, budget: Number.POSITIVE_INFINITY });
    dragged = null;
  };

  const hold = () => {
    grants.clear();
    heldUntilFrame = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        heldUntilFrame = false;
      }),
    );
  };

  const isUserScroll = ({ viewport, delta }: ClassifyParams): boolean => {
    if (heldUntilFrame || delta === 0) {
      return false;
    }
    if (dragged === viewport) {
      return true;
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
    grants.set(viewport, { ...live, budget: Math.max(0, live.budget - Math.abs(delta)) });
    return true;
  };

  return { onWheel, onKey, onTouch, onDragStart, onDragEnd, hold, isUserScroll };
};
