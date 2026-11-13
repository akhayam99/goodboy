import { ICON_SIZE, IconButton, TEXT_ROLE, cn, selectedIconClass } from '@goodboy/ui';
import { PRESSED_TOGGLE } from '../../../../shared/components/pressedToggle';
import { navEntryToneOf } from '../../../../shared/components/navEntryToneOf';
import type { SessionTool } from './sessionTools';
import { ToolCount } from './ToolCount';
import { ToolCountSkeleton } from './ToolCountSkeleton';
import { ToolSignalDot } from './ToolSignalDot';
import { ToolWaitingRing } from './ToolWaitingRing';
import { toolStateOf } from './toolStateOf';
import type { ToolSignal } from './useToolSignal';

type Props = {
  readonly tool: SessionTool;
  readonly isOpen: boolean;
  readonly isWaiting: boolean;
  readonly isCurrent?: boolean;
  readonly fact?: string | null;
  readonly count?: number;
  readonly isCountLoading?: boolean;
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
  count = 0,
  isCountLoading = false,
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
          isLit ? TEXT_ROLE.label : TEXT_ROLE.secondary,
        )}
      >
        {tool.label}
      </span>
      {state === 'waiting' ? <ToolWaitingRing /> : null}
      {signal === null ? null : <ToolSignalDot signal={signal} />}
      {signal === null && isCountLoading ? <ToolCountSkeleton /> : null}
      {signal === null && !isCountLoading && count > 0 ? <ToolCount count={count} /> : null}
    </span>
  );
};
