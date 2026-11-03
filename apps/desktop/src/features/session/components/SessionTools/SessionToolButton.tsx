import { ICON_SIZE, IconButton, cn, selectedIconClass } from '@goodboy/ui';
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
  const name = tool.fullLabel ?? tool.label;
  const label = signal === null ? name : `${name}, ${signal.note}`;
  const tone = navEntryToneOf({ icon: tool.icon });
  return (
    <span className="relative flex min-w-0 flex-col items-center gap-0.5">
      <IconButton
        icon={tool.icon}
        label={label}
        shortcut={tool.shortcut}
        tooltipSide="left"
        size="md"
        iconSize={ICON_SIZE.notice}
        aria-pressed={isOpen}
        tabIndex={tabIndex}
        data-testid={`pane-toggle-${tool.pane}`}
        data-icon-tone={isOpen ? tone : undefined}
        className={cn(PRESSED_TOGGLE, isOpen && selectedIconClass({ tone }))}
        onFocus={onFocus}
        onClick={onToggle}
      />
      {isOpen ? (
        <span aria-hidden className="whitespace-nowrap text-rail text-muted-foreground">
          {tool.label}
        </span>
      ) : null}
      {signal === null ? null : <ToolSignalDot signal={signal} />}
    </span>
  );
};
