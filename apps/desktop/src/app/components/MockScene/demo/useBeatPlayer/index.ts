import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoChapter } from '../demoChapters';
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

type GoToParams = {
  readonly index: number;
};

type FreshParams = {
  readonly chapter: DemoChapter;
};

type PlayerState = {
  readonly chapterId: string;
  readonly beatIndex: number;
  readonly isPlaying: boolean;
  readonly isFinished: boolean;
  readonly replayKey: number;
  readonly playToken: number;
};

export type BeatPlayer = {
  readonly beatIndex: number;
  readonly isPlaying: boolean;
  readonly isRunning: boolean;
  readonly isFinished: boolean;
  readonly replayKey: number;
  readonly runKey: string;
  readonly frame: StageFrame;
  readonly preloadFrame: StageFrame | undefined;
  readonly goTo: (params: GoToParams) => void;
  readonly play: () => void;
  readonly pause: () => void;
  readonly replay: () => void;
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

const freshState = ({ chapter }: FreshParams): PlayerState => ({
  chapterId: chapter.id,
  beatIndex: 0,
  isPlaying: true,
  isFinished: false,
  replayKey: 0,
  playToken: 0,
});

export const useBeatPlayer = ({ chapter, nextChapter, theme, shownKey }: Params): BeatPlayer => {
  const [state, setState] = useState<PlayerState>(() => freshState({ chapter }));

  const current = state.chapterId === chapter.id ? state : freshState({ chapter });
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
  const isShown = shownKey === frame.key;
  const isRunning = current.isPlaying && isShown;
  const runKey = `${chapter.id}:${beatIndex}:${current.replayKey}:${current.playToken}`;

  useEffect(() => {
    if (!isRunning || beat === undefined) {
      return;
    }
    const timer = window.setTimeout(() => {
      setState((previous) => {
        if (previous.beatIndex >= lastIndex) {
          return { ...previous, isPlaying: false, isFinished: true };
        }
        return { ...previous, beatIndex: previous.beatIndex + 1 };
      });
    }, beat.holdMs);
    return () => window.clearTimeout(timer);
  }, [isRunning, beat, lastIndex, runKey]);

  const goTo = useCallback(({ index }: GoToParams) => {
    setState((previous) => ({
      ...previous,
      beatIndex: index,
      isPlaying: false,
      isFinished: false,
    }));
  }, []);

  const replay = useCallback(() => {
    setState((previous) => ({
      ...previous,
      beatIndex: 0,
      isPlaying: true,
      isFinished: false,
      replayKey: previous.replayKey + 1,
    }));
  }, []);

  const play = useCallback(() => {
    setState((previous) => {
      if (previous.isFinished) {
        return {
          ...previous,
          beatIndex: 0,
          isPlaying: true,
          isFinished: false,
          replayKey: previous.replayKey + 1,
        };
      }
      return { ...previous, isPlaying: true, playToken: previous.playToken + 1 };
    });
  }, []);

  const pause = useCallback(() => {
    setState((previous) => (previous.isPlaying ? { ...previous, isPlaying: false } : previous));
  }, []);

  return {
    beatIndex,
    isPlaying: current.isPlaying,
    isRunning,
    isFinished: current.isFinished,
    replayKey: current.replayKey,
    runKey,
    frame,
    preloadFrame,
    goTo,
    play,
    pause,
    replay,
  };
};
