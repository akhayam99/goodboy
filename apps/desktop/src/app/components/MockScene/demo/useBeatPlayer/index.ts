import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DemoChapter } from '../demoChapters';
import type { DemoReport } from '../director/demoProtocol';
import { beatSrc } from '../beatSrc';
import { frameKey } from '../frameKey';

type Params = {
  readonly chapter: DemoChapter;
  readonly nextChapter: DemoChapter | undefined;
  readonly theme: 'dark' | 'light';
  readonly shownKey: string | undefined;
};

export type StageFrame = {
  readonly key: string;
  readonly src: string;
};

export type FrameCommand = {
  readonly key: string;
  readonly type: 'play';
};

export type FrameReportParams = {
  readonly key: string;
  readonly report: DemoReport;
};

type FollowParams = {
  readonly key: string;
  readonly place: string;
};

export type BeatFill = {
  readonly totalMs: number;
  readonly startMs: number;
};

type GoToParams = {
  readonly index: number;
};

type Followed = {
  readonly key: string;
  readonly index: number;
};

type PlayerState = {
  readonly chapterId: string;
  readonly beatIndex: number;
  readonly replayKey: number;
  readonly followed: Followed | null;
  readonly reports: ReadonlyMap<string, DemoReport>;
};

export type BeatPlayer = {
  readonly beatIndex: number;
  readonly isRunning: boolean;
  readonly isComplete: boolean;
  readonly runKey: string;
  readonly fill: BeatFill;
  readonly frame: StageFrame;
  readonly preloadFrame: StageFrame | undefined;
  readonly command: FrameCommand | undefined;
  readonly goTo: (params: GoToParams) => void;
  readonly follow: (params: FollowParams) => void;
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

type FreshParams = {
  readonly chapter: DemoChapter;
  readonly reports: ReadonlyMap<string, DemoReport>;
};

const freshState = ({ chapter, reports }: FreshParams): PlayerState => ({
  chapterId: chapter.id,
  beatIndex: 0,
  replayKey: 0,
  followed: null,
  reports,
});

type KeepParams = {
  readonly reports: ReadonlyMap<string, DemoReport>;
  readonly keys: ReadonlyArray<string>;
};

const keepReports = ({ reports, keys }: KeepParams): ReadonlyMap<string, DemoReport> => {
  const kept = [...reports].filter(([key]) => keys.includes(key));
  return kept.length === reports.size ? reports : new Map(kept);
};

export const useBeatPlayer = ({ chapter, nextChapter, theme, shownKey }: Params): BeatPlayer => {
  const [state, setState] = useState<PlayerState>(() =>
    freshState({ chapter, reports: NO_REPORTS }),
  );

  const current =
    state.chapterId === chapter.id ? state : freshState({ chapter, reports: state.reports });
  if (current !== state) {
    setState(current);
  }

  const lastIndex = chapter.beats.length - 1;
  const frameIndex = Math.min(current.beatIndex, lastIndex);
  const beat = chapter.beats[frameIndex];
  const src = beat === undefined ? '' : beatSrc({ beat, theme });
  const key = frameKey({ src, replayKey: current.replayKey });
  const frame = useMemo(() => ({ key, src }), [key, src]);
  const preloadFrame = useMemo(
    () =>
      nextFrame({
        chapter,
        nextChapter,
        beatIndex: frameIndex,
        theme,
        replayKey: current.replayKey,
      }),
    [chapter, nextChapter, frameIndex, theme, current.replayKey],
  );
  const keysRef = useRef<ReadonlyArray<string>>([]);
  keysRef.current = preloadFrame === undefined ? [frame.key] : [frame.key, preloadFrame.key];

  const followed = current.followed?.key === frame.key ? current.followed.index : null;
  const beatIndex = Math.min(followed ?? frameIndex, lastIndex);
  const frameReport = current.reports.get(frame.key);
  const isShown = shownKey === frame.key;
  const isComplete = frameReport?.type === 'complete';
  const isRunning = isShown && frameReport !== undefined && !isComplete;
  const runKey = `${chapter.id}:${frameIndex}:${current.replayKey}`;
  const totalMs = frameReport?.durationMs ?? 0;
  const startMs = isComplete ? totalMs : (frameReport?.elapsedMs ?? 0);
  const fill = useMemo(() => ({ totalMs, startMs }), [totalMs, startMs]);
  const isPlayable = isShown && frameReport !== undefined;
  const command = useMemo(
    (): FrameCommand | undefined => (isPlayable ? { key: frame.key, type: 'play' } : undefined),
    [frame.key, isPlayable],
  );

  useEffect(() => {
    setState((previous) => {
      const reports = keepReports({ reports: previous.reports, keys: keysRef.current });
      return reports === previous.reports ? previous : { ...previous, reports };
    });
  }, [frame.key, preloadFrame?.key]);

  const report = useCallback(({ key: reportKey, report: next }: FrameReportParams) => {
    if (next.type === 'hint') {
      return;
    }
    setState((previous) => {
      if (!keysRef.current.includes(reportKey)) {
        return previous;
      }
      const reports = new Map(previous.reports);
      reports.set(reportKey, next);
      return { ...previous, reports };
    });
  }, []);

  const goTo = useCallback(({ index }: GoToParams) => {
    setState((previous) => {
      const isSameFrame = previous.beatIndex === index;
      const isWalkedAway = previous.followed !== null && previous.followed.index !== index;
      if (isSameFrame && !isWalkedAway) {
        return previous;
      }
      return {
        ...previous,
        beatIndex: index,
        followed: null,
        replayKey: isSameFrame ? previous.replayKey + 1 : previous.replayKey,
      };
    });
  }, []);

  const { beats } = chapter;
  const follow = useCallback(
    ({ key: placeKey, place }: FollowParams) => {
      const index = beats.findIndex((entry) => entry.place === place);
      setState((previous) => {
        if (index < 0 || placeKey !== keysRef.current[0]) {
          return previous;
        }
        const next = index === previous.beatIndex ? null : { key: placeKey, index };
        if (next?.index === previous.followed?.index && next?.key === previous.followed?.key) {
          return previous;
        }
        return { ...previous, followed: next };
      });
    },
    [beats],
  );

  const replay = useCallback(() => {
    setState((previous) => ({
      ...previous,
      beatIndex: 0,
      followed: null,
      replayKey: previous.replayKey + 1,
    }));
  }, []);

  return {
    beatIndex,
    isRunning,
    isComplete,
    runKey,
    fill,
    frame,
    preloadFrame,
    command,
    goTo,
    follow,
    replay,
    report,
  };
};
