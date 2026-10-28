import { Fragment, useState, type KeyboardEvent } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openPaneOf } from '../../panes/openPaneOf';
import { togglePane } from '../../panes/togglePane';
import { SESSION_TOOLS, type SessionTool } from './sessionTools';
import { SessionToolButton } from './SessionToolButton';
import { toolbarIndexAfter } from './toolbarIndexAfter';
import { useScriptsSignal } from './useScriptsSignal';
import { useTerminalFinishSignal } from './useTerminalFinishSignal';
import { useToolSignal, type ToolSignal } from './useToolSignal';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionTools = ({ sessionId }: Props) => {
  const openPane = useAppStore((state) => openPaneOf({ state, sessionId }));
  const contextSignal = useToolSignal({ sessionId, isContextOpen: openPane === 'context' });
  const scriptsSignal = useScriptsSignal({ sessionId });
  const terminalSignal = useTerminalFinishSignal({
    sessionId,
    isTerminalOpen: openPane === 'terminal',
  });
  const signalOf: Readonly<Partial<Record<SessionTool['pane'], ToolSignal | null>>> = {
    context: contextSignal,
    scripts: scriptsSignal,
    terminal: terminalSignal,
  };
  const [focusIndex, setFocusIndex] = useState(0);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next = toolbarIndexAfter({
      key: event.key,
      from: focusIndex,
      count: SESSION_TOOLS.length,
    });
    if (next === null) {
      return;
    }
    event.preventDefault();
    setFocusIndex(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };
  return (
    <div
      role="toolbar"
      aria-label="Session tools"
      aria-orientation="vertical"
      data-testid="session-tools"
      onKeyDown={onKeyDown}
      className={cn(
        'flex h-full w-10 shrink-0 flex-col items-center gap-1 bg-background px-1',
        PANE_RHYTHM.headerInset,
      )}
    >
      {SESSION_TOOLS.map((tool, index) => (
        <Fragment key={tool.pane}>
          {index > 0 && SESSION_TOOLS[index - 1]?.group !== tool.group ? (
            <span
              role="separator"
              aria-orientation="horizontal"
              data-testid="session-tools-separator"
              className="h-px w-5 shrink-0 bg-border-soft"
            />
          ) : null}
          <SessionToolButton
            tool={tool}
            isOpen={openPane === tool.pane}
            signal={signalOf[tool.pane] ?? null}
            tabIndex={index === focusIndex ? 0 : -1}
            onFocus={() => setFocusIndex(index)}
            onToggle={() => togglePane({ sessionId, pane: tool.pane })}
          />
        </Fragment>
      ))}
    </div>
  );
};
