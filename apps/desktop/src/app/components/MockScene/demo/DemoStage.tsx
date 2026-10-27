import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import { useStageBox } from './useStageBox';
import { stageFitOf } from './stageFitOf';
import { isHoleTooBig } from './hints/isHoleTooBig';
import { DemoStageLoading } from './DemoStageLoading';
import {
  DEMO_PROTOCOL,
  type DemoReport,
  type DemoShortcutCode,
  type DemoTheme,
} from './director/demoProtocol';
import { readDemoReport } from './director/readDemoReport';
import { readDemoHintReport } from './director/readDemoHintReport';
import { readDemoThemeMessage } from './director/readDemoThemeMessage';
import { DemoCoachMark, type CoachMark } from './DemoCoachMark';
import { DemoHintSlot } from './DemoHintSlot';
import type { FrameCommand, FrameReportParams, StageFrame } from './useBeatPlayer';
import type { HintReportParams, HintReveal, HintTrack, OffscreenHint } from './useDemoHints';

const SILENT_LIMIT_MS = 20000;
const FADE_MS = 320;

type ShownParams = {
  readonly key: string;
};

export type ShortcutRequest = {
  readonly code: DemoShortcutCode;
  readonly count: number;
};

type PendingShortcut = {
  readonly code: DemoShortcutCode;
  readonly key: string;
};

type ThemeParams = {
  readonly theme: DemoTheme;
};

type SpotlightParams = {
  readonly isOn: boolean;
};

type Props = {
  readonly theme: DemoTheme;
  readonly onThemeChange: (params: ThemeParams) => void;
  readonly shortcut: ShortcutRequest | undefined;
  readonly frame: StageFrame;
  readonly preloadFrame: StageFrame | undefined;
  readonly command: FrameCommand | undefined;
  readonly onShown: (params: ShownParams) => void;
  readonly onReport: (params: FrameReportParams) => void;
  readonly onFocusLost: () => void;
  readonly hintTrack: HintTrack | undefined;
  readonly coach: CoachMark | undefined;
  readonly offscreen: OffscreenHint | undefined;
  readonly reveal: HintReveal | undefined;
  readonly onHintReport: (params: HintReportParams) => void;
  readonly onSpotlightChange: (params: SpotlightParams) => void;
  readonly onHideHint: () => void;
  readonly onRevealHint: () => void;
};

type WatchParams = {
  readonly key: string;
  readonly frame: HTMLIFrameElement;
};

type SentCommand = {
  readonly generation: number;
  readonly type: FrameCommand['type'] | null;
};

type PostParams = {
  readonly frame: HTMLIFrameElement;
  readonly message: Readonly<Record<string, unknown>>;
};

const postToFrame = ({ frame, message }: PostParams): void => {
  frame.contentWindow?.postMessage(
    { channel: DEMO_PROTOCOL.channel, version: DEMO_PROTOCOL.version, ...message },
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
  theme,
  onThemeChange,
  shortcut,
  frame: activeFrame,
  preloadFrame,
  command,
  onShown,
  onReport,
  onFocusLost,
  hintTrack,
  coach,
  offscreen,
  reveal,
  onHintReport,
  onSpotlightChange,
  onHideHint,
  onRevealHint,
}: Props) => {
  const { ref, box, hasRoom } = useStageBox();
  const activeFit = stageFitOf({ box });
  const isSpotlit =
    coach !== undefined &&
    coach.isDimmed &&
    !isHoleTooBig({
      anchor: coach.rect,
      focus: coach.focus,
      bounds: { width: activeFit.width, height: activeFit.height },
    });
  useEffect(() => {
    onSpotlightChange({ isOn: isSpotlit && coach !== undefined });
  }, [isSpotlit, coach, onSpotlightChange]);
  const [frames, setFrames] = useState<ReadonlyArray<StageFrame>>([]);
  const [mountedKeys, setMountedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [shownKey, setShownKey] = useState<string | undefined>(undefined);
  const [fadingKey, setFadingKey] = useState<string | undefined>(undefined);
  const elements = useRef(new Map<string, HTMLIFrameElement>());
  const sent = useRef(new Map<string, SentCommand>());
  const hintsSent = useRef(new Map<string, string>());
  const themeSent = useRef(new Map<string, DemoTheme>());
  const revealSent = useRef(0);
  const shortcutSeen = useRef(0);
  const pendingShortcut = useRef<PendingShortcut | null>(null);
  const [loadEpoch, setLoadEpoch] = useState(0);

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
    const listener = new AbortController();
    window.addEventListener(
      'message',
      (event) => {
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
        const themeMessage = readDemoThemeMessage({ data: event.data });
        if (themeMessage !== null) {
          if (key === currentKeyRef.current) {
            onThemeChange({ theme: themeMessage.theme });
          }
          return;
        }
        const hintReport = readDemoHintReport({ data: event.data });
        if (hintReport !== null) {
          const isCurrent = key === currentKeyRef.current;
          if (isCurrent && hintReport.generation === sent.current.get(key)?.generation) {
            onHintReport({ key, report: hintReport });
          }
          return;
        }
        const report = readDemoReport({ data: event.data });
        if (report === null) {
          return;
        }
        if (report.type === 'ready') {
          const isReload = sent.current.has(key);
          sent.current.set(key, { generation: report.generation, type: null });
          markMounted({ key });
          themeSent.current.delete(key);
          if (isReload) {
            hintsSent.current.delete(key);
            setLoadEpoch((epoch) => epoch + 1);
          }
          if (isReload && key === currentKeyRef.current) {
            onHintReport({
              key,
              report: {
                channel: DEMO_PROTOCOL.channel,
                version: DEMO_PROTOCOL.version,
                generation: report.generation,
                type: 'anchor',
                hintId: null,
                rect: null,
                isOffscreen: false,
              },
            });
          }
        }
        onReport({ key, report });
      },
      { signal: listener.signal },
    );
    return () => listener.abort();
  }, [markMounted, onReport, onHintReport, onThemeChange]);

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
    if (command === undefined || !mountedKeys.has(command.key)) {
      return;
    }
    const element = elements.current.get(command.key);
    if (element === undefined) {
      return;
    }
    const last = sent.current.get(command.key);
    if (last === undefined || last.type === command.type) {
      return;
    }
    postToFrame({ frame: element, message: { generation: last.generation, type: command.type } });
    sent.current.set(command.key, { generation: last.generation, type: command.type });
  }, [command, mountedKeys, loadEpoch]);

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
    postToFrame({
      frame: element,
      message: {
        generation,
        type: 'hints',
        chapterId: hintTrack.chapterId,
        settledIds: hintTrack.settledIds,
      },
    });
  }, [hintTrack, mountedKeys, currentKey, command, loadEpoch]);

  useEffect(() => {
    for (const [key, element] of elements.current) {
      const generation = sent.current.get(key)?.generation;
      if (generation === undefined || themeSent.current.get(key) === theme) {
        continue;
      }
      themeSent.current.set(key, theme);
      postToFrame({ frame: element, message: { generation, type: 'theme', theme } });
    }
  }, [theme, mountedKeys, loadEpoch]);

  useEffect(() => {
    if (shortcut === undefined || shortcut.count === shortcutSeen.current) {
      return;
    }
    shortcutSeen.current = shortcut.count;
    pendingShortcut.current = { code: shortcut.code, key: currentKeyRef.current };
  }, [shortcut]);

  useEffect(() => {
    const pending = pendingShortcut.current;
    if (pending === null) {
      return;
    }
    if (pending.key !== currentKey) {
      pendingShortcut.current = null;
      return;
    }
    const element = elements.current.get(currentKey);
    const generation = sent.current.get(currentKey)?.generation;
    if (element === undefined || generation === undefined || !mountedKeys.has(currentKey)) {
      return;
    }
    pendingShortcut.current = null;
    element.focus({ preventScroll: true });
    postToFrame({ frame: element, message: { generation, type: 'shortcut', code: pending.code } });
  }, [shortcut, currentKey, mountedKeys, loadEpoch]);

  useEffect(() => {
    if (reveal === undefined || reveal.count === revealSent.current) {
      return;
    }
    const element = elements.current.get(currentKey);
    const generation = sent.current.get(currentKey)?.generation;
    if (element === undefined || generation === undefined) {
      return;
    }
    revealSent.current = reveal.count;
    postToFrame({ frame: element, message: { generation, type: 'reveal', hintId: reveal.hintId } });
  }, [reveal, currentKey]);

  const visibleKey = shownKey ?? currentKey;

  const watch = ({ key, frame }: WatchParams) => {
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
        themeSent.current.delete(key);
      }
    }
  }, [frames]);

  return (
    <div ref={ref} className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
      {hasRoom ? (
        <div
          data-testid="demo-stage"
          className="relative overflow-hidden rounded-lg border border-frame-edge bg-background shadow-md"
          style={{ width: box.width, height: box.height }}
        >
          {mountedKeys.has(currentKey) ? null : <DemoStageLoading label={activeFrame.label} />}
          {coach !== undefined && shownKey === currentKey ? (
            <DemoCoachMark
              coach={coach}
              scale={activeFit.scale}
              bounds={{ width: box.width, height: box.height }}
              isSpotlit={isSpotlit}
              onHide={onHideHint}
            />
          ) : null}
          {offscreen !== undefined && shownKey === currentKey ? (
            <DemoHintSlot hint={offscreen} onReveal={onRevealHint} onHide={onHideHint} />
          ) : null}
          {frames.map((frame) => {
            const isVisible = frame.key === visibleKey && shownKey !== undefined;
            const isFading = frame.key === fadingKey;
            const fit = stageFitOf({ box });
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
                style={{ width: fit.width, height: fit.height, transform: `scale(${fit.scale})` }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
