import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DemoChapter } from '../demoChapters';
import type { DemoCommandType, DemoReport } from '../director/demoProtocol';
import { beatSrc } from '../beatSrc';
import { frameKey } from '../frameKey';

type Params = {
  readonly chapter: DemoChapter;
  readonly nextChapter: DemoChapter | undefined;
  readonly theme: 'dark' | 'light';
  readonly shownKey: string | undefined;
  readonly isReducedMotion: boolean;
};

export type StageFrame = {
  readonly key: string;
  readonly src: string;
};

export type FrameCommand = {
  readonly key: string;
  readonly generation: number;
  readonly type: Exclude<DemoCommandType, 'restart'>;
};

export type FrameReportParams = {
  readonly key: string;
  readonly report: DemoReport;
};

export type BeatFill = {
  readonly totalMs: number;
  readonly startMs: number;
};

type GoToParams = {
  readonly index: number;
};

type FreshParams = {
  readonly chapter: DemoChapter;
  readonly isPlaying: boolean;
  readonly reports: ReadonlyMap<string, DemoReport>;
};

type PlayerState = {
  readonly chapterId: string;
  readonly beatIndex: number;
  readonly isPlaying: boolean;
  readonly isFinished: boolean;
  readonly replayKey: number;
  readonly playToken: number;
  readonly generation: number;
  readonly generationKey: string | null;
  readonly touchedKey: string | null;
  readonly reports: ReadonlyMap<string, DemoReport>;
};

export type BeatPlayer = {
  readonly beatIndex: number;
  readonly isPlaying: boolean;
  readonly isRunning: boolean;
  readonly isFinished: boolean;
  readonly replayKey: number;
  readonly runKey: string;
  readonly fill: BeatFill;
  readonly frame: StageFrame;
  readonly preloadFrame: StageFrame | undefined;
  readonly command: FrameCommand;
  readonly goTo: (params: GoToParams) => void;
  readonly play: () => void;
  readonly pause: () => void;
  readonly interact: () => void;
  readonly replay: () => void;
  readonly report: (params: FrameReportParams) => void;
};

type NextFrameParams = {
  readonly chapter: DemoChapter;
  readonly nextChapter: DemoChapter | undefined;
  readonly beatIndex: number;
  readonly theme: 'dark' | 'light';
  readonly replayKey: number;
};

const nextFrame = ({
  chapter,
  nextChapter,
  beatIndex,
  theme,
  replayKey,
}: NextFrameParams): StageFrame | undefined => {
  const sameChapter = chapter.beats[beatIndex + 1];
  if (sameChapter !== undefined) {
    const src = beatSrc({ beat: sameChapter, theme });
    return { key: frameKey({ src, replayKey }), src };
  }
  const opening = nextChapter?.beats[0];
  if (opening === undefined) {
    return undefined;
  }
  const src = beatSrc({ beat: opening, theme });
  return { key: frameKey({ src, replayKey: 0 }), src };
};

const NO_REPORTS: ReadonlyMap<string, DemoReport> = new Map();

const freshState = ({ chapter, isPlaying, reports }: FreshParams): PlayerState => ({
  chapterId: chapter.id,
  beatIndex: 0,
  isPlaying,
  isFinished: false,
  replayKey: 0,
  playToken: 0,
  generation: 0,
  generationKey: null,
  touchedKey: null,
  reports,
});

type GenerationParams = {
  readonly state: PlayerState;
  readonly key: string;
};

const generationOf = ({ state, key }: GenerationParams): number =>
  state.generationKey === key ? state.generation : 0;

type KeepParams = {
  readonly reports: ReadonlyMap<string, DemoReport>;
  readonly keys: ReadonlyArray<string>;
};

const keepReports = ({ reports, keys }: KeepParams): ReadonlyMap<string, DemoReport> => {
  const kept = [...reports].filter(([key]) => keys.includes(key));
  return kept.length === reports.size ? reports : new Map(kept);
};

type RestartParams = {
  readonly state: PlayerState;
  readonly key: string;
};

const restartInPlace = ({ state, key }: RestartParams): PlayerState => {
  const reports = new Map(state.reports);
  reports.delete(key);
  return {
    ...state,
    isPlaying: true,
    isFinished: false,
    generation: generationOf({ state, key }) + 1,
    generationKey: key,
    touchedKey: null,
    reports,
  };
};

type RestartChapterParams = {
  readonly state: PlayerState;
};

const restartChapter = ({ state }: RestartChapterParams): PlayerState => ({
  ...state,
  beatIndex: 0,
  isPlaying: true,
  isFinished: false,
  replayKey: state.replayKey + 1,
  generation: 0,
  generationKey: null,
  touchedKey: null,
});

export const useBeatPlayer = ({
  chapter,
  nextChapter,
  theme,
  shownKey,
  isReducedMotion,
}: Params): BeatPlayer => {
  const [state, setState] = useState<PlayerState>(() =>
    freshState({ chapter, isPlaying: !isReducedMotion, reports: NO_REPORTS }),
  );

  const current =
    state.chapterId === chapter.id
      ? state
      : freshState({ chapter, isPlaying: !isReducedMotion, reports: state.reports });
  if (current !== state) {
    setState(current);
  }

  const lastIndex = chapter.beats.length - 1;
  const beatIndex = Math.min(current.beatIndex, lastIndex);
  const beat = chapter.beats[beatIndex];
  const src = beat === undefined ? '' : beatSrc({ beat, theme });
  const key = frameKey({ src, replayKey: current.replayKey });
  const frame = useMemo(() => ({ key, src }), [key, src]);
  const preloadFrame = useMemo(
    () => nextFrame({ chapter, nextChapter, beatIndex, theme, replayKey: current.replayKey }),
    [chapter, nextChapter, beatIndex, theme, current.replayKey],
  );
  const keysRef = useRef<ReadonlyArray<string>>([]);
  keysRef.current = preloadFrame === undefined ? [frame.key] : [frame.key, preloadFrame.key];

  const generation = generationOf({ state: current, key: frame.key });
  const frameReport = current.reports.get(frame.key);
  const isShown = shownKey === frame.key;
  const isRunning = current.isPlaying && isShown && frameReport !== undefined;
  const isComplete = frameReport?.type === 'complete';
  const runKey = `${chapter.id}:${beatIndex}:${current.replayKey}:${generation}:${current.playToken}`;
  const holdMs = beat?.holdMs ?? 0;
  const durationMs = frameReport?.durationMs ?? 0;
  const startMs = isComplete ? durationMs : (frameReport?.elapsedMs ?? 0);
  const totalMs = durationMs + holdMs;
  const fill = useMemo(
    () => ({ totalMs, startMs: current.isFinished ? totalMs : startMs }),
    [totalMs, startMs, current.isFinished],
  );
  const commandType: FrameCommand['type'] = isRunning ? 'play' : 'pause';
  const command = useMemo(
    () => ({ key: frame.key, generation, type: commandType }),
    [frame.key, generation, commandType],
  );

  useEffect(() => {
    setState((previous) => {
      const reports = keepReports({ reports: previous.reports, keys: keysRef.current });
      return reports === previous.reports ? previous : { ...previous, reports };
    });
  }, [frame.key, preloadFrame?.key]);

  useEffect(() => {
    if (!isRunning || !isComplete) {
      return;
    }
    const timer = window.setTimeout(() => {
      setState((previous) => {
        if (previous.beatIndex >= lastIndex) {
          return { ...previous, isPlaying: false, isFinished: true };
        }
        return { ...previous, beatIndex: previous.beatIndex + 1, touchedKey: null };
      });
    }, holdMs);
    return () => window.clearTimeout(timer);
  }, [isRunning, isComplete, holdMs, lastIndex, runKey]);

  const report = useCallback(({ key: reportKey, report: next }: FrameReportParams) => {
    if (next.type === 'hint') {
      return;
    }
    setState((previous) => {
      if (!keysRef.current.includes(reportKey)) {
        return previous;
      }
      if (next.generation !== generationOf({ state: previous, key: reportKey })) {
        return previous;
      }
      const reports = new Map(previous.reports);
      reports.set(reportKey, next);
      return { ...previous, reports };
    });
  }, []);

  const goTo = useCallback(({ index }: GoToParams) => {
    setState((previous) => ({
      ...previous,
      beatIndex: index,
      isPlaying: false,
      isFinished: false,
    }));
  }, []);

  const replay = useCallback(() => {
    setState((previous) => {
      const currentKey = keysRef.current[0] ?? '';
      if (previous.beatIndex === 0 && previous.reports.has(currentKey)) {
        return restartInPlace({ state: previous, key: currentKey });
      }
      return restartChapter({ state: previous });
    });
  }, []);

  const play = useCallback(() => {
    setState((previous) => {
      if (previous.isFinished) {
        return restartChapter({ state: previous });
      }
      const currentKey = keysRef.current[0] ?? '';
      const isTouched = previous.touchedKey === currentKey;
      if (isTouched && previous.reports.get(currentKey)?.type !== 'complete') {
        return restartInPlace({ state: previous, key: currentKey });
      }
      return { ...previous, isPlaying: true, playToken: previous.playToken + 1 };
    });
  }, []);

  const pause = useCallback(() => {
    setState((previous) => (previous.isPlaying ? { ...previous, isPlaying: false } : previous));
  }, []);

  const interact = useCallback(() => {
    setState((previous) => {
      const currentKey = keysRef.current[0] ?? null;
      if (!previous.isPlaying && previous.touchedKey === currentKey) {
        return previous;
      }
      return { ...previous, isPlaying: false, touchedKey: currentKey };
    });
  }, []);

  return {
    beatIndex,
    isPlaying: current.isPlaying,
    isRunning,
    isFinished: current.isFinished,
    replayKey: current.replayKey,
    runKey,
    fill,
    frame,
    preloadFrame,
    command,
    goTo,
    play,
    pause,
    interact,
    replay,
    report,
  };
};
