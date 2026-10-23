import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from '../hints/demoHintTypes';
import { DEMO_PROTOCOL, type DemoHintReport, type DemoRect } from './demoProtocol';
import type { DirectorStore } from './directorTypes';

type ReportParams = {
  readonly report: DemoHintReport;
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

const WATCHED_EVENTS = ['resize', 'scroll', 'transitionend', 'animationend'] as const;

type Placement = {
  readonly rect: DemoRect | null;
  readonly isOffscreen: boolean;
};

const MISSING: Placement = { rect: null, isOffscreen: false };

type Box = {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
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
  const armed = new Set<string>();
  const clicked = new Set<string>();
  let start = store.getState();
  let lastSignature = '';
  let pending: number | null = null;
  let isDisposed = false;

  const envelope = () => ({
    channel: DEMO_PROTOCOL.channel,
    version: DEMO_PROTOCOL.version,
    generation: generation(),
  });

  const probeOf = ({ hint, state }: ProbeParams): HintProbe => ({
    state,
    start,
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

  const placementOf = (element: Element | null): Placement => {
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
      return { rect: null, isOffscreen: true };
    }
    return {
      rect: {
        x: Math.round(box.left),
        y: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
      isOffscreen: false,
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
      }
      if (armed.has(hint.id) && hint.doneWhen(probe)) {
        done.add(hint.id);
        onReport({ report: { ...envelope(), type: 'tried', hintId: hint.id } });
      }
    }
    const current = hints
      .filter(
        (hint) =>
          !done.has(hint.id) && !settled.has(hint.id) && hint.revealWhen(probeOf({ hint, state })),
      )
      .map((hint) => ({
        hint,
        placement: placementOf(anchorOf({ hint, probe: probeOf({ hint, state }) })),
      }))
      .find((candidate) => candidate.placement.rect !== null || candidate.placement.isOffscreen);
    const rect = current?.placement.rect ?? null;
    const isOffscreen = current?.placement.isOffscreen ?? false;
    const hintId = current?.hint.id ?? null;
    const signature = JSON.stringify({ hintId, rect, isOffscreen });
    if (signature === lastSignature) {
      return;
    }
    lastSignature = signature;
    onReport({ report: { ...envelope(), type: 'anchor', hintId, rect, isOffscreen } });
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
      chapterId = track;
      hints = hintsOf({ chapterId: track });
      settled = new Set(settledIds);
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
      start = store.getState();
      lastSignature = '';
      lastPlace = null;
      schedule();
    },
    dispose: () => {
      isDisposed = true;
      if (pending !== null) {
        view.cancelAnimationFrame(pending);
      }
      unsubscribe();
      mutations.disconnect();
      for (const type of WATCHED_EVENTS) {
        view.removeEventListener(type, schedule, { capture: true });
      }
      view.removeEventListener('click', onClick, { capture: true });
    },
  };
};
