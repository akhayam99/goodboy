import { ICON_SIZE, IconButton, cn, selectedIconClass } from '@goodboy/ui';
import { PRESSED_TOGGLE } from '../../../../shared/components/pressedToggle';
import { navEntryToneOf } from '../../../../shared/components/navEntryToneOf';
import type { SessionTool } from './sessionTools';
import { ToolSignalDot } from './ToolSignalDot';
import { ToolWaitingRing } from './ToolWaitingRing';
import { toolStateOf } from './toolStateOf';
import type { ToolSignal } from './useToolSignal';

const BUSY_DOT: ToolSignal = { kind: 'running', note: '' };

type Props = {
  readonly tool: SessionTool;
  readonly isOpen: boolean;
  readonly isWaiting: boolean;
  readonly isCurrent?: boolean;
  readonly fact?: string | null;
  readonly isBusy?: boolean;
  readonly signal: ToolSignal | null;
  readonly tabIndex: number;
  readonly onFocus: () => void;
  readonly onToggle: () => void;
};

export const SessionToolButton = ({
  tool,
  isOpen,
  isWaiting,
  isCurrent = false,
  fact = null,
  isBusy = false,
  signal,
  tabIndex,
  onFocus,
  onToggle,
}: Props) => {
  const name = tool.fullLabel ?? tool.label;
  const state = toolStateOf({ isOpen, isWaiting, isCurrent });
  const named = fact === null ? name : `${name}, ${fact}`;
  const stateName = state === 'waiting' ? `${named}, waiting` : named;
  const label = signal === null ? stateName : `${stateName}, ${signal.note}`;
  const tone = navEntryToneOf({ icon: tool.icon });
  const isLit = isOpen || isCurrent;
  const dot = signal ?? (isBusy ? BUSY_DOT : null);
  return (
    <span
      data-slot="session-tool"
      data-state={state}
      className="relative flex min-w-0 flex-col items-center gap-0.5"
    >
      <IconButton
        icon={tool.icon}
        label={label}
        shortcut={tool.shortcut}
        tooltipSide="left"
        size="md"
        iconSize={ICON_SIZE.notice}
        aria-pressed={isLit}
        aria-current={isCurrent ? 'page' : undefined}
        tabIndex={tabIndex}
        data-testid={`pane-toggle-${tool.pane}`}
        data-icon-tone={isLit ? tone : undefined}
        className={cn(PRESSED_TOGGLE, isLit && selectedIconClass({ tone }))}
        onFocus={onFocus}
        onClick={isCurrent ? undefined : onToggle}
      />
      <span
        aria-hidden
        data-slot="tool-caption"
        data-tone={isLit ? 'open' : 'closed'}
        className={cn(
          'whitespace-nowrap text-rail [@media(max-height:480px)]:hidden',
          isLit ? 'text-muted-foreground' : 'text-faint-foreground',
        )}
      >
        {tool.label}
      </span>
      {state === 'waiting' ? <ToolWaitingRing /> : null}
      {dot === null ? null : <ToolSignalDot signal={dot} />}
    </span>
  );
};
