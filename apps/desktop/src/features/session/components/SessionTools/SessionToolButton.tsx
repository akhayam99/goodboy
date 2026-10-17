import { IconButton } from '@goodboy/ui';
import { PRESSED_TOGGLE } from '../../../../shared/components/pressedToggle';
import type { SessionTool } from './sessionTools';
import { ToolSignalDot } from './ToolSignalDot';
import type { ToolSignal } from './useToolSignal';

type Props = {
  readonly tool: SessionTool;
  readonly isOpen: boolean;
  readonly signal: ToolSignal | null;
  readonly tabIndex: number;
  readonly onFocus: () => void;
  readonly onToggle: () => void;
};

export const SessionToolButton = ({ tool, isOpen, signal, tabIndex, onFocus, onToggle }: Props) => {
  const label = signal === null ? tool.label : `${tool.label}, ${signal.note}`;
  return (
    <span className="relative flex">
      <IconButton
        icon={tool.icon}
        label={label}
        tooltip={label}
        shortcut={tool.shortcut}
        tooltipSide="left"
        size="md"
        aria-pressed={isOpen}
        tabIndex={tabIndex}
        data-testid={`pane-toggle-${tool.pane}`}
        className={PRESSED_TOGGLE}
        onFocus={onFocus}
        onClick={onToggle}
      />
      {signal === null ? null : (
        <span className="pointer-events-none absolute right-1 top-1 flex">
          <ToolSignalDot signal={signal} />
        </span>
      )}
    </span>
  );
};
