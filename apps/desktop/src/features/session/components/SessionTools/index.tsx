import { useState, type KeyboardEvent } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openPaneOf } from '../../panes/openPaneOf';
import { togglePane } from '../../panes/togglePane';
import { SESSION_TOOLS } from './sessionTools';
import { SessionToolButton } from './SessionToolButton';
import { toolbarIndexAfter } from './toolbarIndexAfter';
import { useToolSignal } from './useToolSignal';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionTools = ({ sessionId }: Props) => {
  const openPane = useAppStore((state) => openPaneOf({ state, sessionId }));
  const contextSignal = useToolSignal({ sessionId, isContextOpen: openPane === 'context' });
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
        'flex h-full w-32 shrink-0 flex-col items-stretch gap-1 bg-background px-1',
        PANE_RHYTHM.headerInset,
      )}
    >
      {SESSION_TOOLS.map((tool, index) => (
        <SessionToolButton
          key={tool.pane}
          tool={tool}
          isOpen={openPane === tool.pane}
          signal={tool.pane === 'context' ? contextSignal : null}
          tabIndex={index === focusIndex ? 0 : -1}
          onFocus={() => setFocusIndex(index)}
          onToggle={() => togglePane({ sessionId, pane: tool.pane })}
        />
      ))}
    </div>
  );
};
