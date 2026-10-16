import { IconButton, cn } from '@goodboy/ui';
import type { SessionTool } from './sessionTools';
import { ToolSignalDot } from './ToolSignalDot';
import type { ToolSignal } from './useToolSignal';

type Props = {
  readonly tool: SessionTool;
  readonly isOpen: boolean;
  readonly signal: ToolSignal | null;
  readonly onToggle: () => void;
};

export const SessionToolIcon = ({ tool, isOpen, signal, onToggle }: Props) => (
  <span className="relative flex">
    <IconButton
      icon={tool.icon}
      label={signal === null ? tool.label : `${tool.label}, ${signal.note}`}
      shortcut={tool.shortcut}
      tooltipSide="right"
      size="md"
      data-testid={`pane-toggle-${tool.pane}`}
      aria-pressed={isOpen}
      onClick={onToggle}
      className={cn(isOpen && 'bg-selected text-foreground hover:bg-selected')}
    />
    {signal === null ? null : (
      <span className="pointer-events-none absolute right-0.5 top-0.5 flex">
        <ToolSignalDot signal={signal} />
      </span>
    )}
  </span>
);
