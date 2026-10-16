import type { SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { openPaneOf } from '../../panes/openPaneOf';
import { togglePane } from '../../panes/togglePane';
import { SESSION_TOOLS } from './sessionTools';
import { SessionToolIcon } from './SessionToolIcon';
import { SessionToolRow } from './SessionToolRow';
import { useToolSignal } from './useToolSignal';

type Props = {
  readonly sessionId: SessionId;
  readonly isFolded: boolean;
};

export const SessionTools = ({ sessionId, isFolded }: Props) => {
  const openPane = useAppStore((state) => openPaneOf({ state, sessionId }));
  const contextSignal = useToolSignal({ sessionId, isContextOpen: openPane === 'context' });
  return (
    <div
      role="group"
      aria-label="Session tools"
      data-testid="session-tools"
      data-folded={isFolded ? '' : undefined}
      className={cn('flex shrink-0 flex-col', isFolded ? 'items-center gap-1' : 'px-2')}
    >
      {SESSION_TOOLS.map((tool) => {
        const isOpen = openPane === tool.pane;
        const signal = tool.pane === 'context' ? contextSignal : null;
        const onToggle = () => togglePane({ sessionId, pane: tool.pane });
        return isFolded ? (
          <SessionToolIcon
            key={tool.pane}
            tool={tool}
            isOpen={isOpen}
            signal={signal}
            onToggle={onToggle}
          />
        ) : (
          <SessionToolRow
            key={tool.pane}
            tool={tool}
            isOpen={isOpen}
            signal={signal}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
};
