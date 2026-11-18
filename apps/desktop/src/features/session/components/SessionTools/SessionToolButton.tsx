import { DISABLED, ICON_SIZE, IconButton, TEXT_ROLE, cn, selectedIconClass } from '@goodboy/ui';
import { navEntryToneOf } from '../../../../shared/components/navEntryToneOf';
import type { SessionTool } from './sessionTools';
import type { ToolCount } from './ToolCount';
import { ToolCountMark } from './ToolCountMark';
import { ToolSignalDot } from './ToolSignalDot';
import { ToolWaitingRing } from './ToolWaitingRing';
import { toolStateOf } from './toolStateOf';
import type { ToolSignal } from './ToolSignal';

type Props = {
  readonly tool: SessionTool;
  readonly isOpen: boolean;
  readonly isWaiting: boolean;
  readonly isCurrent?: boolean;
  readonly isDisabled?: boolean;
  readonly isCaptioned?: boolean;
  readonly fact?: string | null;
  readonly count?: ToolCount | null;
  readonly signal: ToolSignal | null;
  readonly tabIndex: number;
  readonly onFocus: () => void;
  readonly onToggle: () => void;
};

const QUIET_TILE =
  'aria-pressed:bg-selected aria-pressed:text-foreground aria-pressed:hover:bg-selected';

export const SessionToolButton = ({
  tool,
  isOpen,
  isWaiting,
  isCurrent = false,
  isDisabled = false,
  isCaptioned = true,
  fact = null,
  count = null,
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
  const isInert = isCurrent || isDisabled;
  return (
    <span
      data-slot="session-tool"
      data-state={state}
      className="grid w-full grid-rows-[auto_auto] justify-items-center gap-0.5"
    >
      <span data-slot="tool-icon" className="relative flex">
        <IconButton
          icon={tool.icon}
          label={label}
          shortcut={tool.shortcut}
          tooltipSide="left"
          size="md"
          iconSize={ICON_SIZE.notice}
          aria-pressed={isLit}
          aria-current={isCurrent ? 'page' : undefined}
          aria-disabled={isDisabled ? true : undefined}
          tabIndex={tabIndex}
          data-testid={`pane-toggle-${tool.pane}`}
          data-icon-tone={isLit ? tone : undefined}
          className={cn(QUIET_TILE, isLit && selectedIconClass({ tone }), isDisabled && DISABLED)}
          onFocus={onFocus}
          onClick={isInert ? undefined : onToggle}
        />
        <span
          data-slot="tool-glyph"
          className="pointer-events-none absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2"
        >
          {state === 'waiting' ? <ToolWaitingRing /> : null}
          {signal === null ? null : <ToolSignalDot signal={signal} />}
        </span>
        {count === null ? null : <ToolCountMark count={count} />}
      </span>
      {isCaptioned ? (
        <span
          aria-hidden
          data-slot="tool-caption"
          data-tone={isLit ? 'open' : 'closed'}
          className={cn(
            'whitespace-nowrap text-rail [@media(max-height:480px)]:hidden',
            isLit ? TEXT_ROLE.label : TEXT_ROLE.secondary,
            isDisabled && DISABLED,
          )}
        >
          {tool.label}
        </span>
      ) : null}
    </span>
  );
};
