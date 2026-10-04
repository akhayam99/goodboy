import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
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
]);

export const CommandRowView = ({ row, id, isSelected, onHover, onRun }: Props) => {
  const { item, positions } = row;
  const Icon = item.icon;
  const isBlocked = item.isBlocked === true;
  const isDanger = item.action?.group === 'danger' && item.action.confirm !== null;
  const label = item.action?.confirm != null ? `${item.label}…` : item.label;
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
        'flex h-10 cursor-pointer items-center gap-3 rounded-sm px-3 text-body',
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
          'flex size-6 shrink-0 items-center justify-center rounded-sm',
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
              'min-w-0 flex-1 truncate text-label',
              isBlocked ? 'text-muted-foreground' : 'text-faint-foreground',
            )}
          >
            {item.detail}
          </span>
        )}
      </span>
      {item.shortcut !== undefined ? (
        <kbd className="shrink-0 text-chip text-faint-foreground">
          {shortcutGlyphs(item.shortcut)}
        </kbd>
      ) : item.tag !== undefined ? (
        <span className="shrink-0 text-label text-faint-foreground">{item.tag}</span>
      ) : null}
    </li>
  );
};
