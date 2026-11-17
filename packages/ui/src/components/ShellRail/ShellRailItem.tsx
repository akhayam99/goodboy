import { useContext } from 'react';
import type { IconGlyph } from '../../icons';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { ICON_SIZE, iconWeightOf } from '../../iconSize';
import { selectedIconClass } from '../../selectedIcon';
import { TEXT_ROLE } from '../../textRoles';
import type { Tone } from '../../tint';
import { CountBadge } from '../CountBadge';
import { StatusDot } from '../StatusDot';
import { Tooltip } from '../Tooltip';
import { ShellRailFormContext } from './shellRailFormContext';
import type { ShellRailMark } from './shellRailMark';

type Props = {
  readonly id: string;
  readonly icon: IconGlyph;
  readonly label: string;
  readonly mark?: ShellRailMark | null;
  readonly tone?: Tone;
  readonly shortcut?: string;
  readonly isCurrent?: boolean;
  readonly isPressed?: boolean;
  readonly onSelect: () => void;
};

type MarkParams = {
  readonly mark: ShellRailMark | null;
};

const isMarkShown = ({ mark }: MarkParams): boolean =>
  mark !== null && (mark.kind === 'dot' || mark.count > 0);

export const ShellRailItem = ({
  id,
  icon: Icon,
  label,
  mark = null,
  tone,
  shortcut,
  isCurrent = false,
  isPressed,
  onSelect,
}: Props) => {
  const form = useContext(ShellRailFormContext);
  const isLit = isCurrent || isPressed === true;
  const name = mark !== null && isMarkShown({ mark }) ? `${label}, ${mark.name}` : label;
  const button = (
    <button
      type="button"
      data-shell-rail-item={id}
      aria-label={name}
      aria-current={isCurrent ? 'page' : undefined}
      aria-pressed={isPressed}
      onClick={isCurrent ? undefined : onSelect}
      className={cn(
        'group flex w-full shrink-0 flex-col items-center gap-0.5 rounded-md',
        FOCUS_RING,
        isCurrent && 'cursor-default',
        isLit ? TEXT_ROLE.label : cn(TEXT_ROLE.secondary, 'hover:text-foreground'),
      )}
    >
      <span
        data-slot="rail-tile"
        className={cn(
          'relative flex h-7 items-center justify-center rounded-lg motion-safe:transition-colors',
          form === 'wide' ? 'w-9' : 'w-8',
          isLit ? 'bg-selected' : 'group-hover:bg-hover',
          isLit && tone !== undefined && selectedIconClass({ tone }),
        )}
      >
        <Icon size={ICON_SIZE.hero} weight={iconWeightOf({ size: ICON_SIZE.hero })} aria-hidden />
        <span
          data-slot="rail-mark"
          className="pointer-events-none absolute left-1/2 top-1/2 size-4.5 -translate-x-1/2 -translate-y-1/2"
        >
          {mark?.kind === 'count' ? (
            <CountBadge count={mark.count} tone="warning" placement="corner" isAnnounced={false} />
          ) : null}
          {mark?.kind === 'dot' ? (
            <StatusDot
              tone="unread"
              size="sm"
              className="absolute -right-0.5 -top-0.5 ring-2 ring-chrome"
            />
          ) : null}
        </span>
      </span>
      {form === 'wide' ? (
        <span aria-hidden data-slot="rail-word" className="max-w-full truncate px-0.5 text-rail">
          {label}
        </span>
      ) : null}
    </button>
  );
  if (form === 'wide' && shortcut === undefined) {
    return button;
  }
  return (
    <Tooltip content={name} shortcut={shortcut} side="right">
      {button}
    </Tooltip>
  );
};
