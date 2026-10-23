import { Button, ICON_SIZE, Tooltip, cn, selectedIconClass } from '@goodboy/ui';
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
  const Icon = tool.icon;
  const tone = navEntryToneOf({ icon: tool.icon });
  return (
    <Tooltip content={label} shortcut={tool.shortcut} side="left" anchorClassName="flex w-full">
      <Button
        variant="quiet"
        size="md"
        aria-label={label}
        aria-pressed={isOpen}
        tabIndex={tabIndex}
        data-testid={`pane-toggle-${tool.pane}`}
        data-icon-tone={isOpen ? tone : undefined}
        className={cn(
          'w-full justify-start',
          PRESSED_TOGGLE,
          isOpen && selectedIconClass({ tone }),
        )}
        onFocus={onFocus}
        onClick={onToggle}
      >
        <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">{tool.label}</span>
        {signal === null ? null : <ToolSignalDot signal={signal} />}
      </Button>
    </Tooltip>
  );
};
