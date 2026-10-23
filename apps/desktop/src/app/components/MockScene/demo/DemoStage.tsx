import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import { useStageScale } from './useStageScale';
import { DemoStageLoading } from './DemoStageLoading';
import { STAGE_BACKDROP } from './stageBackdrop';
import { DEMO_PROTOCOL, type DemoCommandType, type DemoReport } from './director/demoProtocol';
import { isDemoReport } from './director/isDemoReport';
import { isDemoHintReport } from './director/isDemoHintReport';
import { DemoCoachMark, type CoachMark } from './DemoCoachMark';
import type { FrameCommand, FrameReportParams, StageFrame } from './useBeatPlayer';
import type { HintReportParams, HintTrack } from './useDemoHints';

const APP_WIDTH = 1440;
const APP_HEIGHT = 900;
const STAGE_INSET = 16;
const SILENT_LIMIT_MS = 20000;
const FADE_MS = 320;
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const;

type ShownParams = {
  readonly key: string;
};

type Props = {
  readonly frame: StageFrame;
  readonly preloadFrame: StageFrame | undefined;
  readonly command: FrameCommand;
  readonly onShown: (params: ShownParams) => void;
  readonly onReport: (params: FrameReportParams) => void;
  readonly onInteract: () => void;
  readonly onFocusLost: () => void;
  readonly hintTrack: HintTrack | undefined;
  readonly coach: CoachMark | undefined;
  readonly onHintReport: (params: HintReportParams) => void;
  readonly onSkipHint: () => void;
  readonly onHideHint: () => void;
};

type WatchParams = {
  readonly key: string;
  readonly frame: HTMLIFrameElement;
};

type SentCommand = {
  readonly generation: number;
  readonly type: Exclude<DemoCommandType, 'restart'>;
};

type PostParams = {
  readonly frame: HTMLIFrameElement;
  readonly generation: number;
  readonly type: DemoCommandType;
};

const postCommand = ({ frame, generation, type }: PostParams): void => {
  frame.contentWindow?.postMessage(
    { channel: DEMO_PROTOCOL.channel, version: DEMO_PROTOCOL.version, generation, type },
    window.location.origin,
  );
};

const SILENT_REPORT: DemoReport = {
  channel: DEMO_PROTOCOL.channel,
  version: DEMO_PROTOCOL.version,
  generation: 0,
  type: 'complete',
  elapsedMs: 0,
  durationMs: 0,
  cueIndex: 0,
};

export const DemoStage = ({
  frame: activeFrame,
  preloadFrame,
  command,
  onShown,
  onReport,
  onInteract,
  onFocusLost,
  hintTrack,
  coach,
  onHintReport,
  onSkipHint,
  onHideHint,
}: Props) => {
  const { ref, scale, hasRoom } = useStageScale({
    width: APP_WIDTH,
    height: APP_HEIGHT,
    inset: STAGE_INSET,
  });
  const [frames, setFrames] = useState<ReadonlyArray<StageFrame>>([]);
  const [mountedKeys, setMountedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [shownKey, setShownKey] = useState<string | undefined>(undefined);
  const [fadingKey, setFadingKey] = useState<string | undefined>(undefined);
  const elements = useRef(new Map<string, HTMLIFrameElement>());
  const sent = useRef(new Map<string, SentCommand>());
  const hintsSent = useRef(new Map<string, string>());

  const currentKey = activeFrame.key;
  const currentKeyRef = useRef(currentKey);
  currentKeyRef.current = currentKey;

  const markMounted = useCallback(
    ({ key }: ShownParams) => {
      setMountedKeys((previous) => (previous.has(key) ? previous : new Set([...previous, key])));
      if (document.activeElement === elements.current.get(key)) {
        onFocusLost();
      }
    },
    [onFocusLost],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const entry = [...elements.current].find(
        ([, element]) => element.contentWindow !== null && element.contentWindow === event.source,
      );
      if (entry === undefined) {
        return;
      }
      const [key] = entry;
      if (isDemoHintReport(event.data)) {
        const isCurrent = key === currentKeyRef.current;
        if (isCurrent && event.data.generation === sent.current.get(key)?.generation) {
          onHintReport({ key, report: event.data });
        }
        return;
      }
      if (!isDemoReport(event.data)) {
        return;
      }
      const report = event.data;
      if (report.type === 'ready') {
        sent.current.set(key, { generation: report.generation, type: 'pause' });
        markMounted({ key });
      }
      onReport({ key, report });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [markMounted, onReport, onHintReport]);

  useEffect(() => {
    const isPreloading =
      preloadFrame !== undefined &&
      preloadFrame.key !== currentKey &&
      fadingKey === undefined &&
      shownKey === currentKey;
    const wanted: ReadonlyArray<StageFrame> =
      isPreloading && preloadFrame !== undefined ? [activeFrame, preloadFrame] : [activeFrame];
    const kept = new Set([currentKey, shownKey, fadingKey, ...wanted.map((frame) => frame.key)]);
    setMountedKeys((previous) => {
      const next = new Set([...previous].filter((key) => kept.has(key)));
      return next.size === previous.size ? previous : next;
    });
    setFrames((existing) => {
      const keep = existing.filter((frame) => kept.has(frame.key));
      const missing = wanted.filter((frame) => !keep.some((entry) => entry.key === frame.key));
      if (missing.length === 0 && keep.length === existing.length) {
        return existing;
      }
      return [...keep, ...missing];
    });
  }, [activeFrame, preloadFrame, currentKey, shownKey, fadingKey, mountedKeys]);

  useEffect(() => {
    if (!mountedKeys.has(currentKey) || shownKey === currentKey) {
      return;
    }
    setFadingKey(shownKey);
    setShownKey(currentKey);
    onShown({ key: currentKey });
  }, [mountedKeys, currentKey, shownKey, onShown]);

  useEffect(() => {
    if (fadingKey === undefined) {
      return;
    }
    const drop = window.setTimeout(() => setFadingKey(undefined), FADE_MS);
    return () => window.clearTimeout(drop);
  }, [fadingKey]);

  useEffect(() => {
    if (!mountedKeys.has(command.key)) {
      return;
    }
    const element = elements.current.get(command.key);
    if (element === undefined) {
      return;
    }
    const last = sent.current.get(command.key);
    if (last !== undefined && last.generation < command.generation) {
      postCommand({ frame: element, generation: command.generation, type: 'restart' });
      sent.current.set(command.key, { generation: command.generation, type: 'pause' });
    }
    const latest = sent.current.get(command.key);
    if (latest?.generation === command.generation && latest.type === command.type) {
      return;
    }
    postCommand({ frame: element, generation: command.generation, type: command.type });
    sent.current.set(command.key, { generation: command.generation, type: command.type });
  }, [command, mountedKeys]);

  useEffect(() => {
    if (hintTrack === undefined || !mountedKeys.has(currentKey)) {
      return;
    }
    const element = elements.current.get(currentKey);
    const generation = sent.current.get(currentKey)?.generation;
    if (element === undefined || generation === undefined) {
      return;
    }
    const signature = JSON.stringify({ generation, ...hintTrack });
    if (hintsSent.current.get(currentKey) === signature) {
      return;
    }
    hintsSent.current.set(currentKey, signature);
    element.contentWindow?.postMessage(
      {
        channel: DEMO_PROTOCOL.channel,
        version: DEMO_PROTOCOL.version,
        generation,
        type: 'hints',
        chapterId: hintTrack.chapterId,
        settledIds: hintTrack.settledIds,
      },
      window.location.origin,
    );
  }, [hintTrack, mountedKeys, currentKey, command]);

  const visibleKey = shownKey ?? currentKey;

  const watch = ({ key, frame }: WatchParams) => {
    for (const type of INPUT_EVENTS) {
      frame.contentWindow?.addEventListener(type, onInteract, { capture: true, passive: true });
    }
    window.setTimeout(() => {
      if (!frame.isConnected || sent.current.has(key)) {
        return;
      }
      markMounted({ key });
      onReport({ key, report: SILENT_REPORT });
    }, SILENT_LIMIT_MS);
  };

  const bindFrame =
    ({ key }: ShownParams) =>
    (element: HTMLIFrameElement | null) => {
      if (element === null) {
        return;
      }
      elements.current.set(key, element);
    };

  useEffect(() => {
    const live = new Set(frames.map((frame) => frame.key));
    for (const key of [...elements.current.keys()]) {
      if (!live.has(key)) {
        elements.current.delete(key);
        sent.current.delete(key);
        hintsSent.current.delete(key);
      }
    }
  }, [frames]);

  return (
    <div ref={ref} className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
      {hasRoom ? (
        <div
          className="flex items-center justify-center rounded-frame"
          style={{
            backgroundImage: STAGE_BACKDROP,
            width: APP_WIDTH * scale + STAGE_INSET * 2,
            height: APP_HEIGHT * scale + STAGE_INSET * 2,
          }}
        >
          <div
            data-testid="demo-stage"
            className="relative overflow-hidden rounded-lg border border-frame-edge bg-background shadow-lg"
            style={{ width: APP_WIDTH * scale, height: APP_HEIGHT * scale }}
          >
            {shownKey === undefined ? <DemoStageLoading /> : null}
            {coach !== undefined && shownKey === currentKey ? (
              <DemoCoachMark
                coach={coach}
                scale={scale}
                bounds={{ width: APP_WIDTH * scale, height: APP_HEIGHT * scale }}
                onSkip={onSkipHint}
                onHide={onHideHint}
              />
            ) : null}
            {frames.map((frame) => {
              const isVisible = frame.key === visibleKey && shownKey !== undefined;
              const isFading = frame.key === fadingKey;
              return (
                <iframe
                  key={frame.key}
                  ref={bindFrame({ key: frame.key })}
                  title={isVisible ? 'Goodboy app' : 'Goodboy app, next step'}
                  src={frame.src}
                  tabIndex={isVisible ? 0 : -1}
                  aria-hidden={isVisible ? undefined : true}
                  data-shown={frame.key === visibleKey ? 'true' : 'false'}
                  onLoad={(event) => watch({ key: frame.key, frame: event.currentTarget })}
                  className={cn(
                    'absolute left-0 top-0 origin-top-left border-0',
                    isVisible
                      ? 'z-10 opacity-100 motion-safe:transition-opacity motion-safe:duration-300'
                      : 'pointer-events-none',
                    isFading ? 'z-0 opacity-100' : '',
                    !isVisible && !isFading ? 'opacity-0' : '',
                  )}
                  style={{ width: APP_WIDTH, height: APP_HEIGHT, transform: `scale(${scale})` }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
