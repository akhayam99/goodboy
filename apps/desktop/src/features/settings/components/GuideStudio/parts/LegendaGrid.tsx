import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type LegendaRow = {
  readonly label: string;
  readonly desc: string;
  readonly dot?: string;
  readonly node?: ReactNode;
};

type Props = {
  readonly rows: ReadonlyArray<LegendaRow>;
};

export const LegendaGrid = ({ rows }: Props) => (
  <ul className="flex flex-col gap-1">
    {rows.map((row) => (
      <li key={row.label} className="flex items-center gap-3">
        {row.node === undefined ? (
          <span
            aria-hidden
            className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', row.dot)}
          />
        ) : (
          <span aria-hidden className="inline-flex w-3.5 shrink-0 justify-center">
            {row.node}
          </span>
        )}
        <span className="w-28 shrink-0 text-row text-foreground">{row.label}</span>
        <span className="text-body text-muted-foreground">{row.desc}</span>
      </li>
    ))}
  </ul>
);
