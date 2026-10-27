import { ChevronRight } from 'lucide-react';
import { cn, ICON_SIZE, KeyHint } from '@goodboy/ui';

import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { CommandRow } from '../../commandList';
import type { PaletteKind } from '../../types';
import { MatchLabel } from './MatchLabel';

type Props = {
  readonly row: CommandRow;
  readonly id: string;
  readonly isSelected: boolean;
  readonly onHover: () => void;
  readonly onRun: () => void;
};

const TILED: ReadonlySet<PaletteKind> = new Set<PaletteKind>([
  'session',
  'agent',
  'artifact',
  'workspace',
  'script',
  'workflow',
  'run',
  'needs',
]);

export const CommandRowView = ({ row, id, isSelected, onHover, onRun }: Props) => {
  const { item, positions } = row;
  const Icon = item.icon;
  const isBlocked = item.isBlocked === true;
  const isDanger = item.action?.group === 'danger' && item.action.confirm?.role === 'danger';
  const label =
    item.action?.confirm != null || item.confirm != null ? `${item.label}…` : item.label;
  const hasLevel = item.level !== undefined;
  return (
    <li
      id={id}
      role="option"
      aria-selected={isSelected}
      aria-label={label}
      aria-description={item.detail}
      aria-disabled={isBlocked || undefined}
      data-key={item.key}
      data-selected={isSelected || undefined}
      className={cn(
        'flex h-7 cursor-pointer items-center gap-2 rounded-sm px-2 text-body',
        isSelected ? 'bg-selected' : 'hover:bg-hover',
      )}
      onMouseMove={onHover}
      onMouseDown={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm',
          TILED.has(item.kind) && 'bg-fill',
        )}
      >
        {item.accent === undefined ? (
          <Icon
            size={ICON_SIZE.control}
            className={isDanger ? 'text-danger' : 'text-muted-foreground'}
          />
        ) : (
          <span className={cn('size-2 rounded-full', item.accent)} />
        )}
      </span>
      <span
        className={cn(
          'flex min-w-0 flex-1 items-baseline gap-2',
          isBlocked ? 'text-disabled-foreground' : isDanger ? 'text-danger' : 'text-foreground',
        )}
      >
        <MatchLabel label={label} positions={positions} />
        {item.detail !== undefined && item.detail !== '' && (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-meta',
              isBlocked ? 'text-muted-foreground' : 'text-faint-foreground',
            )}
          >
            {item.detail}
          </span>
        )}
      </span>
      {item.shortcut !== undefined ? (
        <span className="flex min-w-11 shrink-0 justify-end">
          <KeyHint keys={shortcutGlyphs(item.shortcut)} />
        </span>
      ) : item.tag !== undefined ? (
        <span className="shrink-0 text-meta text-faint-foreground">{item.tag}</span>
      ) : null}
      {hasLevel && (
        <ChevronRight
          size={ICON_SIZE.control}
          aria-hidden
          className="shrink-0 text-faint-foreground"
        />
      )}
    </li>
  );
};
