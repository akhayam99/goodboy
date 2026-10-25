import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from '../hints/demoHintTypes';
import { DEMO_PROTOCOL, type DemoHintReport, type DemoRect } from './demoProtocol';
import type { DirectorStore } from './directorTypes';
import { createResultTracker } from './createResultTracker';
import { focusRegionOf } from './focusRegionOf';
import { unionOf } from './unionOf';

type ReportParams = {
  readonly report: DemoHintReport;
};

type HintIdParams = {
  readonly hintId: string;
};

type TrackParams = {
  readonly chapterId: string;
};

type PlaceParams = TrackParams & {
  readonly root: Document;
};

type Params = {
  readonly store: DirectorStore;
  readonly view: Window;
  readonly generation: () => number;
  readonly hintsOf: (params: TrackParams) => ReadonlyArray<DemoHint>;
  readonly placeOf: (params: PlaceParams) => string | null;
  readonly onReport: (params: ReportParams) => void;
};

type RevealParams = {
  readonly hintId: string;
};

type SetTrackParams = {
  readonly chapterId: string;
  readonly settledIds: ReadonlyArray<string>;
};

export type HintEngine = {
  readonly setTrack: (params: SetTrackParams) => void;
  readonly reveal: (params: RevealParams) => void;
  readonly reset: () => void;
  readonly dispose: () => void;
};

type ProbeParams = {
  readonly hint: DemoHint;
  readonly state: AppStore;
};

type AnchorParams = {
  readonly hint: DemoHint;
  readonly probe: HintProbe;
};

type RegionParams = {
  readonly hint: DemoHint;
  readonly probe: HintProbe;
  readonly anchor: Element;
};

type RegionElementParams = {
  readonly region: Element | null;
};

type StateParams = {
  readonly state: AppStore;
};

type ElementParams = {
  readonly element: Element | null;
  readonly region: Element | null;
};

const CUT_TOLERANCE = 2;
const DWELL_MS = 2500;
const HOVER_GRACE_MS = 600;
const MAX_DWELL_MS = 8000;
const DWELL_SLACK_MS = 30;

const WATCHED_EVENTS = ['resize', 'scroll', 'transitionend', 'animationend'] as const;

type Placement = {
  readonly rect: DemoRect | null;
  readonly focus: DemoRect | null;
  readonly isOffscreen: boolean;
  readonly isCut: boolean;
};

type Current = {
  readonly hint: DemoHint;
  readonly placement: Placement;
};

const MISSING: Placement = { rect: null, focus: null, isOffscreen: false, isCut: false };

type Box = {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
};

type BoxParams = {
  readonly box: Box;
};

const rectOfBox = ({ box }: BoxParams): DemoRect | null => {
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return {
    x: Math.round(box.left),
    y: Math.round(box.top),
    width: Math.round(width),
    height: Math.round(height),
  };
};

type ClipParams = {
  readonly element: Element;
  readonly view: Window;
};

const isClipping = ({ element, view }: ClipParams): boolean => {
  const style = view.getComputedStyle(element);
  return style.overflowX !== 'visible' || style.overflowY !== 'visible';
};

const visibleBoxOf = ({ element, view }: ClipParams): Box => {
  let box: Box = { top: 0, left: 0, bottom: view.innerHeight, right: view.innerWidth };
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    if (!isClipping({ element: parent, view })) {
      continue;
    }
    const clip = parent.getBoundingClientRect();
    box = {
      top: Math.max(box.top, clip.top),
      left: Math.max(box.left, clip.left),
      bottom: Math.min(box.bottom, clip.bottom),
      right: Math.min(box.right, clip.right),
    };
  }
  return box;
};

export const createHintEngine = ({
  store,
  view,
  generation,
  hintsOf,
  placeOf,
  onReport,
}: Params): HintEngine => {
  const root = view.document;
  let chapterId: string | null = null;
  let lastPlace: string | null = null;
  let hints: ReadonlyArray<DemoHint> = [];
  let settled: ReadonlySet<string> = new Set();
  const done = new Set<string>();
  const dwelt = new Set<string>();
  let shownId: string | null = null;
  const armed = new Set<string>();
  const clicked = new Set<string>();
  const scrolled = new Set<string>();
  const baselines = new Map<string, AppStore>();
  let lastSignature = '';
  let pending: number | null = null;
  let isDisposed = false;
  let dwellUntil = 0;
  let dwellStart = 0;
  let dwellTimer: number | null = null;
  const results = createResultTracker({ view, onChange: () => schedule() });

  const envelope = () => ({
    channel: DEMO_PROTOCOL.channel,
    version: DEMO_PROTOCOL.version,
    generation: generation(),
  });

  const probeOf = ({ hint, state }: ProbeParams): HintProbe => ({
    state,
    start: baselines.get(hint.id) ?? state,
    root,
    isAnchorClicked: clicked.has(hint.id),
  });

  const anchorOf = ({ hint, probe }: AnchorParams): Element | null => {
    const selector = typeof hint.anchor === 'string' ? hint.anchor : hint.anchor(probe);
    if (selector === null) {
      return null;
    }
    return root.querySelector(selector);
  };

  const regionOf = ({ hint, probe, anchor }: RegionParams): Element | null => {
    const selector = typeof hint.focus === 'function' ? hint.focus(probe) : (hint.focus ?? null);
    const named = selector === null ? null : anchor.closest(selector);
    if (named !== null) {
      return named;
    }
    return focusRegionOf({ anchor, view });
  };

  const focusOf = ({ region }: RegionElementParams): DemoRect | null => {
    if (region === null) {
      return null;
    }
    const box = region.getBoundingClientRect();
    const visible = visibleBoxOf({ element: region, view });
    return rectOfBox({
      box: {
        top: Math.max(box.top, visible.top),
        left: Math.max(box.left, visible.left),
        bottom: Math.min(box.bottom, visible.bottom),
        right: Math.min(box.right, visible.right),
      },
    });
  };

  const placementOf = ({ element, region }: ElementParams): Placement => {
    if (element === null) {
      return MISSING;
    }
    const box = element.getBoundingClientRect();
    if (box.width <= 0 && box.height <= 0) {
      return MISSING;
    }
    const visible = visibleBoxOf({ element, view });
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const isShown =
      centerX >= visible.left &&
      centerX <= visible.right &&
      centerY >= visible.top &&
      centerY <= visible.bottom;
    if (!isShown) {
      return { rect: null, focus: null, isOffscreen: true, isCut: false };
    }
    const isCut =
      box.top < visible.top - CUT_TOLERANCE ||
      box.bottom > visible.bottom + CUT_TOLERANCE ||
      box.left < visible.left - CUT_TOLERANCE ||
      box.right > visible.right + CUT_TOLERANCE;
    return {
      rect: rectOfBox({ box }),
      focus: focusOf({ region }),
      isOffscreen: false,
      isCut,
    };
  };

  const reportPlace = (): void => {
    if (chapterId === null) {
      return;
    }
    const place = placeOf({ chapterId, root });
    if (place === null || place === lastPlace) {
      return;
    }
    lastPlace = place;
    onReport({ report: { ...envelope(), type: 'place', place } });
  };

  const placeHint = ({ hint, state }: ProbeParams): Placement => {
    const probe = probeOf({ hint, state });
    const anchor = anchorOf({ hint, probe });
    const place = (): Placement =>
      placementOf({
        element: anchor,
        region: anchor === null ? null : regionOf({ hint, probe, anchor }),
      });
    const placement = place();
    const isScrollNeeded = placement.isOffscreen || placement.isCut;
    if (anchor === null || !isScrollNeeded || scrolled.has(hint.id) || results.isOpen()) {
      return placement;
    }
    scrolled.add(hint.id);
    anchor.scrollIntoView({ block: 'center', inline: 'nearest' });
    return place();
  };

  const currentOf = ({ state }: StateParams): Current | undefined => {
    for (const hint of hints) {
      if (done.has(hint.id) || settled.has(hint.id) || !hint.revealWhen(probeOf({ hint, state }))) {
        continue;
      }
      const placement = placeHint({ hint, state });
      if (placement.rect !== null || placement.isOffscreen) {
        return { hint, placement };
      }
    }
    return undefined;
  };

  const startDwell = ({ hintId }: HintIdParams): void => {
    dwelt.add(hintId);
    dwellStart = Date.now();
    dwellUntil = dwellStart + DWELL_MS;
  };

  const isDwelling = (): boolean => {
    if (dwellUntil === 0) {
      return false;
    }
    const now = Date.now();
    if (results.isHovered() && now < dwellStart + MAX_DWELL_MS) {
      dwellUntil = Math.max(dwellUntil, now + HOVER_GRACE_MS);
    }
    if (now >= dwellUntil) {
      dwellUntil = 0;
      return false;
    }
    if (dwellTimer !== null) {
      view.clearTimeout(dwellTimer);
    }
    dwellTimer = view.setTimeout(schedule, dwellUntil - now + DWELL_SLACK_MS);
    return true;
  };

  const evaluate = (): void => {
    pending = null;
    if (isDisposed) {
      return;
    }
    reportPlace();
    if (hints.length === 0) {
      return;
    }
    const state = store.getState();
    for (const hint of hints) {
      if (done.has(hint.id)) {
        continue;
      }
      const probe = probeOf({ hint, state });
      if (!armed.has(hint.id) && hint.revealWhen(probe)) {
        armed.add(hint.id);
        baselines.set(hint.id, state);
      }
      if (armed.has(hint.id) && hint.doneWhen(probe)) {
        done.add(hint.id);
        startDwell({ hintId: hint.id });
        onReport({ report: { ...envelope(), type: 'tried', hintId: hint.id } });
      }
    }
    let current = isDwelling() ? undefined : currentOf({ state });
    const previousId = shownId;
    const isReplaced =
      previousId !== null &&
      current?.hint.id !== previousId &&
      !dwelt.has(previousId) &&
      clicked.has(previousId);
    if (previousId !== null && isReplaced && dwellUntil === 0) {
      startDwell({ hintId: previousId });
      isDwelling();
      current = undefined;
    }
    if (current !== undefined) {
      shownId = current.hint.id;
    }
    const rect = current?.placement.rect ?? null;
    const resultRects = current === undefined ? [] : results.rects();
    const focus =
      rect === null || resultRects.length === 0
        ? (current?.placement.focus ?? null)
        : unionOf({ rects: [current?.placement.focus ?? rect, ...resultRects] });
    const isOffscreen = current?.placement.isOffscreen ?? false;
    const hintId = current?.hint.id ?? null;
    const isClicked = hintId !== null && clicked.has(hintId);
    const signature = JSON.stringify({ hintId, rect, focus, isOffscreen, isClicked });
    if (signature === lastSignature) {
      return;
    }
    lastSignature = signature;
    onReport({
      report: { ...envelope(), type: 'anchor', hintId, rect, focus, isOffscreen, isClicked },
    });
  };

  const schedule = (): void => {
    if (pending !== null || isDisposed) {
      return;
    }
    pending = view.requestAnimationFrame(evaluate);
  };

  const onClick = (event: MouseEvent): void => {
    if (!event.isTrusted || !(event.target instanceof Node)) {
      return;
    }
    const target = event.target;
    const state = store.getState();
    for (const hint of hints) {
      const anchor = anchorOf({ hint, probe: probeOf({ hint, state }) });
      if (anchor !== null && anchor.contains(target)) {
        clicked.add(hint.id);
      }
    }
    schedule();
  };

  const unsubscribe = store.subscribe(schedule);
  const mutations = new MutationObserver(schedule);
  mutations.observe(root.documentElement, { subtree: true, childList: true, attributes: true });
  for (const type of WATCHED_EVENTS) {
    view.addEventListener(type, schedule, { capture: true, passive: true });
  }
  view.addEventListener('click', onClick, { capture: true });

  return {
    setTrack: ({ chapterId: track, settledIds }) => {
      if (chapterId !== track) {
        scrolled.clear();
      }
      chapterId = track;
      hints = hintsOf({ chapterId: track });
      settled = new Set(settledIds);
      shownId = null;
      lastSignature = '';
      schedule();
    },
    reveal: ({ hintId }) => {
      const hint = hints.find((entry) => entry.id === hintId);
      if (hint === undefined) {
        return;
      }
      const anchor = anchorOf({ hint, probe: probeOf({ hint, state: store.getState() }) });
      anchor?.scrollIntoView({ block: 'center', inline: 'nearest' });
      schedule();
    },
    reset: () => {
      done.clear();
      armed.clear();
      clicked.clear();
      scrolled.clear();
      baselines.clear();
      lastSignature = '';
      lastPlace = null;
      dwellUntil = 0;
      dwelt.clear();
      shownId = null;
      results.reset();
      schedule();
    },
    dispose: () => {
      isDisposed = true;
      if (pending !== null) {
        view.cancelAnimationFrame(pending);
      }
      if (dwellTimer !== null) {
        view.clearTimeout(dwellTimer);
      }
      results.dispose();
      unsubscribe();
      mutations.disconnect();
      for (const type of WATCHED_EVENTS) {
        view.removeEventListener(type, schedule, { capture: true });
      }
      view.removeEventListener('click', onClick, { capture: true });
    },
  };
};
