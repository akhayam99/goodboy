import { ICON_SIZE, IconButton, cn, selectedIconClass } from '@goodboy/ui';
import { PRESSED_TOGGLE } from '../../../../shared/components/pressedToggle';
import { navEntryToneOf } from '../../../../shared/components/navEntryToneOf';
import type { SessionTool } from './sessionTools';
import { ToolSignalDot } from './ToolSignalDot';
import { ToolWaitingRing } from './ToolWaitingRing';
import { toolStateOf } from './toolStateOf';
import type { ToolSignal } from './useToolSignal';

type Props = {
  readonly tool: SessionTool;
  readonly isOpen: boolean;
  readonly isWaiting: boolean;
  readonly signal: ToolSignal | null;
  readonly tabIndex: number;
  readonly onFocus: () => void;
  readonly onToggle: () => void;
};

export const SessionToolButton = ({
  tool,
  isOpen,
  isWaiting,
  signal,
  tabIndex,
  onFocus,
  onToggle,
}: Props) => {
  const name = tool.fullLabel ?? tool.label;
  const stateName = isWaiting && !isOpen ? `${name}, waiting` : name;
  const label = signal === null ? stateName : `${stateName}, ${signal.note}`;
  const tone = navEntryToneOf({ icon: tool.icon });
  return (
    <span
      data-slot="session-tool"
      data-state={toolStateOf({ isOpen, isWaiting })}
      className="relative flex min-w-0 flex-col items-center gap-0.5"
    >
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
      <span
        aria-hidden
        data-slot="tool-caption"
        data-tone={isOpen ? 'open' : 'closed'}
        className={cn(
          'whitespace-nowrap text-rail [@media(max-height:480px)]:hidden',
          isOpen ? 'text-muted-foreground' : 'text-faint-foreground',
        )}
      >
        {tool.label}
      </span>
      {isWaiting && !isOpen ? <ToolWaitingRing /> : null}
      {signal === null ? null : <ToolSignalDot signal={signal} />}
    </span>
  );
};
