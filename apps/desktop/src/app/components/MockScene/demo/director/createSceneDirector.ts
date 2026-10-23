import type { IsoDateTime } from '@goodboy/types';
import { DEMO_PROTOCOL, type DemoReport, type DemoReportType } from './demoProtocol';
import type { PlaybackClock } from './createPlaybackClock';
import { demoRuns } from './demoRunRegistry';
import type { CueParams, DemoCue, DemoTimeline, DirectorStore } from './directorTypes';

type ReportParams = {
  readonly report: DemoReport;
};

type Params = {
  readonly timeline: DemoTimeline;
  readonly store: DirectorStore;
  readonly clock: PlaybackClock;
  readonly isSettled: boolean;
  readonly now: () => IsoDateTime;
  readonly onReport: (params: ReportParams) => void;
};

type RestartParams = {
  readonly generation: number;
};

export type SceneDirector = {
  readonly generation: () => number;
  readonly start: () => void;
  readonly play: () => void;
  readonly pause: () => void;
  readonly settle: () => void;
  readonly restart: (params: RestartParams) => void;
  readonly dispose: () => void;
};

type EmitParams = {
  readonly type: DemoReportType;
  readonly hint?: string;
};

type OrderParams = {
  readonly timeline: DemoTimeline;
};

const orderedCues = ({ timeline }: OrderParams): ReadonlyArray<DemoCue> =>
  [...timeline.cues].sort((left, right) => left.atMs - right.atMs);

export const createSceneDirector = ({
  timeline,
  store,
  clock,
  isSettled,
  now,
  onReport,
}: Params): SceneDirector => {
  const cues = isSettled ? [] : orderedCues({ timeline });
  const durationMs = cues.at(-1)?.atMs ?? 0;
  timeline.setup?.({ store });
  const snapshot = store.getState();
  let generation = 0;
  let cueIndex = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emit = ({ type, hint }: EmitParams): void => {
    onReport({
      report: {
        channel: DEMO_PROTOCOL.channel,
        version: DEMO_PROTOCOL.version,
        generation,
        type,
        elapsedMs: Math.min(clock.elapsed(), durationMs),
        durationMs,
        cueIndex,
        ...(hint === undefined ? {} : { hint }),
      },
    });
  };

  const cueParams = (): CueParams => ({
    store,
    at: now(),
    hint: ({ text }) => emit({ type: 'hint', hint: text }),
  });

  const clearTimer = (): void => {
    if (timer === null) {
      return;
    }
    clearTimeout(timer);
    timer = null;
  };

  const prepare = (): void => {
    if (isSettled) {
      return;
    }
    timeline.prepare(cueParams());
  };

  const tick = (): void => {
    timer = null;
    const elapsed = clock.elapsed();
    let isAdvanced = false;
    let due = cues[cueIndex];
    while (due !== undefined && due.atMs <= elapsed) {
      due.apply(cueParams());
      cueIndex += 1;
      isAdvanced = true;
      due = cues[cueIndex];
    }
    const upcoming = cues[cueIndex];
    if (upcoming === undefined) {
      clock.pause();
      emit({ type: 'complete' });
      return;
    }
    if (isAdvanced) {
      emit({ type: 'progress' });
    }
    timer = setTimeout(tick, Math.max(0, upcoming.atMs - elapsed));
  };

  return {
    generation: () => generation,
    start: () => {
      prepare();
      emit({ type: 'ready' });
    },
    play: () => {
      if (cueIndex >= cues.length) {
        emit({ type: 'complete' });
        return;
      }
      if (clock.isRunning()) {
        return;
      }
      clock.resume();
      tick();
    },
    pause: () => {
      if (!clock.isRunning()) {
        return;
      }
      clearTimer();
      clock.pause();
      emit({ type: 'progress' });
    },
    settle: () => {
      if (cueIndex >= cues.length) {
        return;
      }
      clearTimer();
      clock.pause();
      for (const cue of cues.slice(cueIndex)) {
        cue.apply(cueParams());
      }
      cueIndex = cues.length;
      emit({ type: 'complete' });
    },
    restart: ({ generation: next }: RestartParams) => {
      clearTimer();
      demoRuns.cancelAll();
      clock.reset();
      cueIndex = 0;
      generation = next;
      store.setState(snapshot, true);
      prepare();
      emit({ type: 'ready' });
    },
    dispose: () => {
      clearTimer();
      demoRuns.cancelAll();
      clock.pause();
    },
  };
};
