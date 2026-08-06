import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Divider, Popover, ScrollFade, Tooltip, cn } from '@goodboy/ui';
import { Terminal } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { RunningScriptRow } from './RunningScriptRow';
import { useRunningScripts, type RunningScript } from './useRunningScripts';

type PopoverCoordinates = {
  readonly top?: number;
  readonly bottom?: number;
  readonly left: number;
};

const DROPDOWN_WIDTH = 384;
const VIEWPORT_MARGIN = 8;
const DROPDOWN_MAX_HEIGHT = 437;

export const RunningScriptsIndicator = () => {
  const running = useRunningScripts();
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const cancelScript = useAppStore((state) => state.cancelScript);
  const [isOpen, setIsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coordinates, setCoordinates] = useState<PopoverCoordinates | null>(null);
  const count = running.length;

  useEffect(() => {
    if (count === 0) {
      setIsOpen(false);
    }
  }, [count]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (trigger == null) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const desiredLeft = centerX - DROPDOWN_WIDTH / 2;
      const maxLeft = window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_MARGIN;
      const left = Math.min(Math.max(desiredLeft, VIEWPORT_MARGIN), maxLeft);
      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldOpenAbove = spaceBelow < DROPDOWN_MAX_HEIGHT + VIEWPORT_MARGIN;
      setCoordinates({
        top: shouldOpenAbove ? undefined : rect.bottom + 6,
        bottom: shouldOpenAbove ? window.innerHeight - rect.top + 6 : undefined,
        left,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  if (count === 0) {
    return null;
  }

  const onOpen = (run: RunningScript) => {
    setIsOpen(false);
    void setCurrentSession(run.sessionId).then(() => {
      setActiveLens(run.sessionId, 'scripts');
    });
  };

  const onStop = (run: RunningScript) => {
    void cancelScript(run.sessionId, run.scriptId);
  };

  const label = `${count} ${count === 1 ? 'script' : 'scripts'} running`;

  return (
    <>
      <Tooltip content={label} side="top">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={label}
          aria-expanded={isOpen}
          className={cn(
            'relative flex items-center gap-1 rounded p-1.5 motion-safe:transition-colors',
            isOpen ? 'bg-muted text-info' : 'text-info hover:bg-muted/50',
          )}
        >
          <Terminal size={14} aria-hidden />
          <span className="text-2xs font-semibold tabular-nums">{count}</span>
        </button>
      </Tooltip>

      {isOpen && coordinates != null
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-popover-backdrop"
                onClick={() => setIsOpen(false)}
                aria-hidden
              />
              <Popover
                role="dialog"
                ariaLabel="Running scripts"
                className="fixed z-popover w-96"
                style={{
                  top: coordinates.top,
                  bottom: coordinates.bottom,
                  left: coordinates.left,
                }}
              >
                <header className="px-3 py-2">
                  <span className="text-xs font-semibold text-foreground">Running scripts</span>
                </header>
                <Divider />
                <ScrollFade className="max-h-[25rem]" fadeSize={16} fadeFrom="elevated">
                  <ul aria-label="Running scripts">
                    {running.map((run) => (
                      <RunningScriptRow
                        key={`${run.sessionId}:${run.scriptId}`}
                        run={run}
                        now={now}
                        onOpen={onOpen}
                        onStop={onStop}
                      />
                    ))}
                  </ul>
                </ScrollFade>
              </Popover>
            </>,
            document.body,
          )
        : null}
    </>
  );
};
