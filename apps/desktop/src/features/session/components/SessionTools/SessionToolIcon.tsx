import { SelectableRow } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { SessionTool } from './sessionTools';
import { ToolSignalDot } from './ToolSignalDot';
import type { ToolSignal } from './useToolSignal';

type Props = {
  readonly tool: SessionTool;
  readonly isOpen: boolean;
  readonly signal: ToolSignal | null;
  readonly onToggle: () => void;
};

export const SessionToolIcon = ({ tool, isOpen, signal, onToggle }: Props) => {
  const Icon = tool.icon;
  const label = signal === null ? tool.label : `${tool.label}, ${signal.note}`;
  return (
    <SelectableRow
      selected={isOpen}
      isPressed={isOpen}
      testId={`pane-toggle-${tool.pane}`}
      title={label}
      shortcut={tool.shortcut}
      tooltipSide="right"
      ariaLabel={label}
      onClick={onToggle}
      className="relative h-7 items-center px-2"
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      {signal === null ? null : (
        <span className="pointer-events-none absolute right-0.5 top-0.5 flex">
          <ToolSignalDot signal={signal} />
        </span>
      )}
    </SelectableRow>
  );
};
