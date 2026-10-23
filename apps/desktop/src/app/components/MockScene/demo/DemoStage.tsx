import { useEffect, useState } from 'react';
import { cn } from '@goodboy/ui';
import { useStageScale } from './useStageScale';
import { isFrameMounted } from './isFrameMounted';
import type { StageFrame } from './useBeatPlayer';

const APP_WIDTH = 1440;
const APP_HEIGHT = 900;
const POLL_MS = 120;
const POLL_LIMIT_MS = 30000;
const SETTLE_MS = 400;
const FADE_MS = 320;

type ShownParams = {
  readonly key: string;
};

type Props = {
  readonly frame: StageFrame;
  readonly preloadFrame: StageFrame | undefined;
  readonly onShown: (params: ShownParams) => void;
  readonly onInteract: () => void;
  readonly onFocusLost: () => void;
};

type WatchParams = {
  readonly key: string;
  readonly frame: HTMLIFrameElement;
};

export const DemoStage = ({
  frame: activeFrame,
  preloadFrame,
  onShown,
  onInteract,
  onFocusLost,
}: Props) => {
  const { ref, scale, hasRoom } = useStageScale({ width: APP_WIDTH, height: APP_HEIGHT });
  const [frames, setFrames] = useState<ReadonlyArray<StageFrame>>([]);
  const [mountedKeys, setMountedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [shownKey, setShownKey] = useState<string | undefined>(undefined);
  const [fadingKey, setFadingKey] = useState<string | undefined>(undefined);

  const currentKey = activeFrame.key;

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

  const visibleKey = shownKey ?? currentKey;

  const watch = ({ key, frame }: WatchParams) => {
    const startedAt = performance.now();
    frame.contentWindow?.addEventListener('pointerdown', onInteract);
    const settle = () => {
      if (!frame.isConnected) {
        return;
      }
      setMountedKeys((previous) => new Set([...previous, key]));
      if (document.activeElement === frame) {
        onFocusLost();
      }
    };
    const poll = () => {
      if (!frame.isConnected) {
        return;
      }
      const isTimedOut = performance.now() - startedAt > POLL_LIMIT_MS;
      if (isTimedOut || isFrameMounted({ frame })) {
        window.setTimeout(settle, SETTLE_MS);
        return;
      }
      window.setTimeout(poll, POLL_MS);
    };
    poll();
  };

  return (
    <div ref={ref} className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
      <div
        data-testid="demo-stage"
        className="relative overflow-hidden rounded-lg border border-frame-edge bg-background shadow-lg"
        style={{ width: APP_WIDTH * scale, height: APP_HEIGHT * scale }}
      >
        {(hasRoom ? frames : []).map((frame) => {
          const isVisible = frame.key === visibleKey;
          const isFading = frame.key === fadingKey;
          return (
            <iframe
              key={frame.key}
              title={isVisible ? 'Goodboy app' : 'Goodboy app, next step'}
              src={frame.src}
              tabIndex={isVisible ? 0 : -1}
              aria-hidden={isVisible ? undefined : true}
              data-shown={isVisible ? 'true' : 'false'}
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
  );
};
