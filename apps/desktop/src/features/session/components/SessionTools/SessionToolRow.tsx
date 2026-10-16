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

export const SessionToolRow = ({ tool, isOpen, signal, onToggle }: Props) => {
  const Icon = tool.icon;
  return (
    <SelectableRow
      selected={isOpen}
      isPressed={isOpen}
      testId={`pane-toggle-${tool.pane}`}
      title={signal?.note ?? tool.tooltip}
      shortcut={tool.shortcut}
      tooltipSide="right"
      ariaLabel={signal === null ? tool.label : `${tool.label}, ${signal.note}`}
      onClick={onToggle}
      className="h-7 items-center gap-2 px-2 text-ui"
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{tool.label}</span>
      <span className="flex w-10 shrink-0 items-center justify-end">
        {signal === null ? null : <ToolSignalDot signal={signal} />}
      </span>
    </SelectableRow>
  );
};
