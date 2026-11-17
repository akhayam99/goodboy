import { useContext } from 'react';
import type { IconGlyph } from '../../icons';
import { cn } from '../../cn';
import { ICON_SIZE } from '../../iconSize';
import { selectedIconClass } from '../../selectedIcon';
import { TEXT_ROLE } from '../../textRoles';
import { tintClasses, type Tone } from '../../tint';
import { CountBadge } from '../CountBadge';
import { IconButton } from '../IconButton';
import { StatusDot } from '../StatusDot';
import { ShellRailFormContext } from './shellRailFormContext';
import { ShellRailRing } from './ShellRailRing';
import type { ShellRailMark } from './shellRailMark';

type Props = {
  readonly id: string;
  readonly icon: IconGlyph;
  readonly label: string;
  readonly word?: string;
  readonly mark?: ShellRailMark | null;
  readonly tone?: Tone;
  readonly shortcut?: string;
  readonly isCurrent?: boolean;
  readonly isPressed?: boolean;
  readonly isQuiet?: boolean;
  readonly isOutlined?: boolean;
  readonly tint?: Tone;
  readonly isEdged?: boolean;
  readonly isBreathing?: boolean;
  readonly onSelect: () => void;
};

type MarkParams = {
  readonly mark: ShellRailMark | null;
};

const LIT_TILE = 'bg-selected text-foreground hover:bg-selected';

const isMarkShown = ({ mark }: MarkParams): boolean =>
  mark !== null && (mark.kind !== 'count' || mark.count > 0);

export const ShellRailItem = ({
  id,
  icon,
  label,
  word = label,
  mark = null,
  tone,
  shortcut,
  isCurrent = false,
  isPressed,
  isQuiet = false,
  isOutlined = false,
  tint,
  isEdged = false,
  isBreathing = false,
  onSelect,
}: Props) => {
  const form = useContext(ShellRailFormContext);
  const isLit = isCurrent || isPressed === true;
  const isFaint = isQuiet && !isLit;
  const tinted = tint === undefined ? null : tintClasses(tint);
  const name = mark !== null && isMarkShown({ mark }) ? `${label}, ${mark.name}` : label;
  return (
    <span
      data-slot="shell-rail-item"
      className="grid w-full shrink-0 grid-rows-[auto_auto] justify-items-center gap-0.5"
    >
      <span className="relative flex">
        <IconButton
          icon={icon}
          label={name}
          shortcut={shortcut}
          tooltipSide="right"
          isTooltipSuppressed={form === 'wide' && shortcut === undefined && word === label}
          size="md"
          {...(tint !== undefined && { tone: tint, 'data-tint': tint })}
          variant={isOutlined ? 'outline' : 'ghost'}
          iconSize={ICON_SIZE.hero}
          data-shell-rail-item={id}
          {...(isEdged && { 'data-edged': '' })}
          aria-current={isCurrent ? 'page' : undefined}
          aria-pressed={isPressed}
          className={cn(
            isCurrent && 'cursor-default',
            isFaint && 'text-faint-foreground',
            isLit && LIT_TILE,
            isLit && tone !== undefined && selectedIconClass({ tone }),
            tinted !== null && !isLit && tinted.bg,
            tinted !== null && isEdged && ['ring-1', tinted.ring],
            isBreathing && 'motion-safe:animate-arrival-breath',
          )}
          onClick={isCurrent ? undefined : onSelect}
        />
        <span
          data-slot="rail-mark"
          className="pointer-events-none absolute left-1/2 top-1/2 size-4.5 -translate-x-1/2 -translate-y-1/2"
        >
          {mark?.kind === 'count' ? (
            <CountBadge count={mark.count} tone="warning" placement="corner" isAnnounced={false} />
          ) : null}
          {mark?.kind === 'ring' && tint !== undefined ? (
            <ShellRailRing percent={mark.percent} tone={tint} />
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
        <span
          aria-hidden
          data-slot="rail-word"
          className={cn(
            'max-w-full truncate px-0.5 text-rail',
            isLit ? TEXT_ROLE.label : tinted === null ? TEXT_ROLE.secondary : tinted.text,
            isFaint && TEXT_ROLE.hint,
          )}
        >
          {word}
        </span>
      ) : null}
    </span>
  );
};
