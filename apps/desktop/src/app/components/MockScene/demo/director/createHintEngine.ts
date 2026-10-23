import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintProbe } from '../hints/demoHintTypes';
import { DEMO_PROTOCOL, type DemoHintReport, type DemoRect } from './demoProtocol';
import type { DirectorStore } from './directorTypes';

type ReportParams = {
  readonly report: DemoHintReport;
};

type Params = {
  readonly store: DirectorStore;
  readonly view: Window;
  readonly generation: () => number;
  readonly hintsOf: (params: TrackParams) => ReadonlyArray<DemoHint>;
  readonly onReport: (params: ReportParams) => void;
};

type TrackParams = {
  readonly chapterId: string;
};

type SetTrackParams = {
  readonly chapterId: string;
  readonly settledIds: ReadonlyArray<string>;
};

export type HintEngine = {
  readonly setTrack: (params: SetTrackParams) => void;
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

export const createHintEngine = ({
  store,
  view,
  generation,
  hintsOf,
  onReport,
}: Params): HintEngine => {
  const root = view.document;
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

  const rectOf = (element: Element | null): DemoRect | null => {
    if (element === null) {
      return null;
    }
    const box = element.getBoundingClientRect();
    if (box.width <= 0 && box.height <= 0) {
      return null;
    }
    const isOutside =
      box.bottom <= 0 ||
      box.right <= 0 ||
      box.top >= view.innerHeight ||
      box.left >= view.innerWidth;
    if (isOutside) {
      return null;
    }
    return {
      x: Math.round(box.left),
      y: Math.round(box.top),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  };

  const evaluate = (): void => {
    pending = null;
    if (isDisposed || hints.length === 0) {
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
        rect: rectOf(anchorOf({ hint, probe: probeOf({ hint, state }) })),
      }))
      .find((candidate) => candidate.rect !== null);
    const rect = current?.rect ?? null;
    const hintId = current?.hint.id ?? null;
    const signature = JSON.stringify({ hintId, rect });
    if (signature === lastSignature) {
      return;
    }
    lastSignature = signature;
    onReport({ report: { ...envelope(), type: 'anchor', hintId, rect } });
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
    setTrack: ({ chapterId, settledIds }) => {
      hints = hintsOf({ chapterId });
      settled = new Set(settledIds);
      lastSignature = '';
      schedule();
    },
    reset: () => {
      done.clear();
      armed.clear();
      clicked.clear();
      start = store.getState();
      lastSignature = '';
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
