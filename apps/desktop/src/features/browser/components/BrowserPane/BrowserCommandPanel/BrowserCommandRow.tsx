import type { ReactNode } from 'react';
import { Globe, History, SquareArrowOutUpRight, type LucideIcon } from 'lucide-react';
import { ICON_SIZE, KeyHint, cn } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import type { CommandRow } from '../../../types';
import { BrowserFavicon } from '../BrowserFavicon';

type Props = {
  readonly row: CommandRow;
  readonly id: string;
  readonly isSelected: boolean;
  readonly onHover: () => void;
  readonly onRun: () => void;
};

type RowParams = {
  readonly row: CommandRow;
};

const commandTitleOf = ({ row }: RowParams): string => {
  if (row.kind === 'open' || row.kind === 'outside') {
    return row.label;
  }
  return row.title;
};

const commandDetailOf = ({ row }: RowParams): string => {
  if (row.kind === 'open') {
    return 'Beside this session';
  }
  if (row.kind === 'outside') {
    return 'In your browser';
  }
  return row.address;
};

const ICONS = {
  open: Globe,
  outside: SquareArrowOutUpRight,
  visit: History,
} satisfies Record<Exclude<CommandRow['kind'], 'tab'>, LucideIcon>;

const commandIconOf = ({ row }: RowParams): ReactNode => {
  if (row.kind === 'tab') {
    return <BrowserFavicon url={row.tab.url} isPin={row.isPin} />;
  }
  const Icon = ICONS[row.kind];
  return <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0 text-muted-foreground" />;
};

const commandEndOf = ({ row }: RowParams): ReactNode => {
  if (row.kind === 'open') {
    return <KeyHint keys={shortcutGlyphs('list.open')} />;
  }
  if (row.kind === 'outside') {
    return <KeyHint keys={shortcutGlyphs('composer.submit')} />;
  }
  if (row.kind === 'tab' && row.isPin) {
    return <span className="shrink-0 text-meta text-faint-foreground">Pinned</span>;
  }
  if (row.kind === 'tab' && row.place !== null) {
    return (
      <span className="min-w-0 shrink truncate text-meta text-faint-foreground">{row.place}</span>
    );
  }
  return null;
};

export const BrowserCommandRow = ({ row, id, isSelected, onHover, onRun }: Props) => {
  const title = commandTitleOf({ row });
  const detail = commandDetailOf({ row });
  const isCode = row.kind !== 'open' && row.kind !== 'outside';
  return (
    <li
      id={id}
      role="option"
      aria-selected={isSelected}
      aria-label={title}
      aria-description={detail}
      data-key={row.key}
      className={cn(
        'flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-sm px-2',
        isSelected ? 'bg-selected' : 'hover:bg-hover',
      )}
      onMouseMove={onHover}
      onMouseDown={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center">
        {commandIconOf({ row })}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="min-w-0 truncate text-row text-foreground">{title}</span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-faint-foreground',
            isCode ? 'text-code' : 'text-meta',
          )}
        >
          {detail}
        </span>
      </span>
      {commandEndOf({ row })}
    </li>
  );
};
