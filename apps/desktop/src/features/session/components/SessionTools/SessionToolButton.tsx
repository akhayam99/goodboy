import { IconButton, cn, selectedIconClass } from '@goodboy/ui';
import { PRESSED_TOGGLE } from '../../../../shared/components/pressedToggle';
import { navEntryToneOf } from '../../../../shared/components/navEntryToneOf';
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
  const tone = navEntryToneOf({ icon: tool.icon });
  return (
    <span className="relative flex">
      <IconButton
        icon={tool.icon}
        label={label}
        shortcut={tool.shortcut}
        tooltipSide="left"
        size="md"
        aria-pressed={isOpen}
        tabIndex={tabIndex}
        data-testid={`pane-toggle-${tool.pane}`}
        data-icon-tone={isOpen ? tone : undefined}
        className={cn(PRESSED_TOGGLE, isOpen && selectedIconClass({ tone }))}
        onFocus={onFocus}
        onClick={onToggle}
      />
      {signal === null ? null : <ToolSignalDot signal={signal} />}
    </span>
  );
};
