import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DemoBeat, DemoChapter } from '../demoChapters';
import type { DemoReport } from '../director/demoProtocol';
import { beatSrc } from '../beatSrc';
import { frameKey } from '../frameKey';

type Params = {
  readonly chapter: DemoChapter;
  readonly beatIndex: number;
  readonly preloadBeat: DemoBeat | undefined;
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

type Carry = {
  readonly chapterId: string;
  readonly frame: StageFrame;
};

type PlayerState = {
  readonly chapterId: string;
  readonly replayKey: number;
  readonly reports: ReadonlyMap<string, DemoReport>;
  readonly carried: StageFrame | undefined;
  readonly carry: Carry | undefined;
};

type CarryParams = {
  readonly chapterId: string;
};

export type BeatPlayer = {
  readonly isComplete: boolean;
  readonly frame: StageFrame;
  readonly preloadFrame: StageFrame | undefined;
  readonly command: FrameCommand | undefined;
  readonly replay: () => void;
  readonly carry: (params: CarryParams) => void;
  readonly report: (params: FrameReportParams) => void;
};

const NO_REPORTS: ReadonlyMap<string, DemoReport> = new Map();

type FreshParams = {
  readonly chapter: DemoChapter;
  readonly reports: ReadonlyMap<string, DemoReport>;
  readonly carry?: Carry | undefined;
};

const freshState = ({ chapter, reports, carry }: FreshParams): PlayerState => ({
  chapterId: chapter.id,
  replayKey: 0,
  reports,
  carried: carry?.chapterId === chapter.id ? carry.frame : undefined,
  carry: undefined,
});

type KeepParams = {
  readonly reports: ReadonlyMap<string, DemoReport>;
  readonly keys: ReadonlyArray<string>;
};

const keepReports = ({ reports, keys }: KeepParams): ReadonlyMap<string, DemoReport> => {
  const kept = [...reports].filter(([key]) => keys.includes(key));
  return kept.length === reports.size ? reports : new Map(kept);
};

export const useBeatPlayer = ({
  chapter,
  beatIndex,
  preloadBeat,
  theme,
  shownKey,
}: Params): BeatPlayer => {
  const [state, setState] = useState<PlayerState>(() =>
    freshState({ chapter, reports: NO_REPORTS }),
  );

  const current =
    state.chapterId === chapter.id
      ? state
      : freshState({ chapter, reports: state.reports, carry: state.carry });
  if (current !== state) {
    setState(current);
  }

  const beat = chapter.beats[Math.min(beatIndex, chapter.beats.length - 1)];
  const src = beat === undefined ? '' : beatSrc({ beat, theme });
  const key = beat === undefined ? '' : frameKey({ beat, replayKey: current.replayKey });
  const ownFrame = useMemo(() => ({ key, src }), [key, src]);
  const frame = beatIndex === 0 && current.carried !== undefined ? current.carried : ownFrame;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const preloadFrame = useMemo((): StageFrame | undefined => {
    if (preloadBeat === undefined) {
      return undefined;
    }
    return {
      key: frameKey({ beat: preloadBeat, replayKey: 0 }),
      src: beatSrc({ beat: preloadBeat, theme }),
    };
  }, [preloadBeat, theme]);
  const keysRef = useRef<ReadonlyArray<string>>([]);
  keysRef.current = preloadFrame === undefined ? [frame.key] : [frame.key, preloadFrame.key];

  const frameReport = current.reports.get(frame.key);
  const isShown = shownKey === frame.key;
  const isComplete = frameReport?.type === 'complete';
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

  const replay = useCallback(() => {
    setState((previous) => ({
      ...previous,
      carried: undefined,
      replayKey: previous.replayKey + 1,
    }));
  }, []);

  const carry = useCallback(({ chapterId }: CarryParams) => {
    setState((previous) => ({ ...previous, carry: { chapterId, frame: frameRef.current } }));
  }, []);

  return { isComplete, frame, preloadFrame, command, replay, carry, report };
};
