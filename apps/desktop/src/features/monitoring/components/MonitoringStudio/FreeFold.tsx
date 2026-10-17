import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { portListText } from '../../portListText';
import type { PortRow } from '@goodboy/core';

type RenderParams = {
  readonly row: PortRow;
  readonly isNested: boolean;
};

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly renderRow: (params: RenderParams) => ReactNode;
};

const PORTS_SHOWN = 6;

export const FreeFold = ({ rows, renderRow }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const text = `${rows.length} free`;
  const label = `${text}: ${portListText({ ports: rows.map((row) => row.port), max: PORTS_SHOWN })}`;

  return (
    <li className="flex flex-col">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={label}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        className={cn(
          'flex min-h-8 items-center gap-3 rounded-md px-2 text-left text-label text-faint-foreground',
          ROW_INTERACTIVE,
        )}
      >
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn('shrink-0 motion-safe:transition-transform', isOpen && 'rotate-90')}
        />
        <span className="min-w-0 truncate tabular-nums">{text}</span>
      </button>
      {isOpen ? (
        <ul className="flex flex-col">{rows.map((row) => renderRow({ row, isNested: true }))}</ul>
      ) : null}
    </li>
  );
};
