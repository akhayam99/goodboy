import { cn } from '@goodboy/ui';

type LegendaRow = {
  readonly dot: string;
  readonly label: string;
  readonly desc: string;
};

type Props = {
  readonly rows: ReadonlyArray<LegendaRow>;
};

export const LegendaGrid = ({ rows }: Props) => (
  <ul className="flex flex-col gap-1">
    {rows.map((row) => (
      <li key={row.label} className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', row.dot)}
        />
        <span className="w-28 shrink-0 text-sm font-medium text-foreground">{row.label}</span>
        <span className="text-sm text-muted-foreground">{row.desc}</span>
      </li>
    ))}
  </ul>
);
