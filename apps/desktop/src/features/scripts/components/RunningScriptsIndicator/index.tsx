import { useEffect, useState } from 'react';
import { AnchoredPopover, cn, Divider, ScrollFade, Tooltip, useDropdown } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { RunningScriptRow } from './RunningScriptRow';
import { useRunningScripts, type RunningScript } from './useRunningScripts';

const DROPDOWN_WIDTH = 384;
const DROPDOWN_MAX_HEIGHT = 437;

export const RunningScriptsIndicator = () => {
  const running = useRunningScripts();
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const cancelScript = useAppStore((state) => state.cancelScript);
  const [now, setNow] = useState(() => Date.now());
  const dropdown = useDropdown({
    align: 'center',
    width: 'w-96',
    expectedWidth: DROPDOWN_WIDTH,
    expectedHeight: DROPDOWN_MAX_HEIGHT,
  });
  const { open: isOpen, close, toggle } = dropdown;
  const count = running.length;

  useEffect(() => {
    if (count === 0) {
      close();
    }
  }, [close, count]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  if (count === 0) {
    return null;
  }

  const onOpen = (run: RunningScript) => {
    close();
    void setCurrentSession(run.sessionId).then(() => {
      setActiveLens(run.sessionId, 'scripts');
    });
  };

  const onStop = (run: RunningScript) => {
    void cancelScript(run.sessionId, run.scriptId);
  };

  const label = `${count} ${count === 1 ? 'script' : 'scripts'} running`;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Running scripts"
      hasBackdrop
      trigger={
        <Tooltip content={label} side="top">
          <button
            type="button"
            onClick={toggle}
            aria-label={label}
            aria-expanded={isOpen}
            className={cn(
              'relative flex items-center gap-1 rounded p-1.5 motion-safe:transition-colors',
              isOpen ? 'bg-muted text-info' : 'text-info hover:bg-muted/50',
            )}
          >
            <CONCEPT_ICONS.scripts size={14} aria-hidden />
            <span className="text-2xs font-semibold tabular-nums">{count}</span>
          </button>
        </Tooltip>
      }
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
    </AnchoredPopover>
  );
};
