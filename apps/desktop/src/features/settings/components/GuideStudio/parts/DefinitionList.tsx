import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

type DefinitionRow = {
  readonly term: string;
  readonly desc: string;
  readonly icon?: ReactNode;
  readonly tone?: Tone;
};

type Props = {
  readonly rows: ReadonlyArray<DefinitionRow>;
};

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
  info: 'bg-info/10',
  muted: 'bg-muted',
};

const TONE_FG: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  muted: 'text-muted-foreground',
};

export const DefinitionList = ({ rows }: Props) => (
  <ul className="flex flex-col gap-2">
    {rows.map((row) => (
      <li
        key={row.term}
        className="flex items-start gap-3 rounded-md border border-border-soft bg-subtle/40 px-3 py-2.5"
      >
        {row.icon ? (
          <span
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
              TONE_BG[row.tone ?? 'muted'],
              TONE_FG[row.tone ?? 'muted'],
            )}
          >
            {row.icon}
          </span>
        ) : (
          <span
            className={cn(
              'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
              TONE_FG[row.tone ?? 'muted'].replace('text-', 'bg-'),
            )}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{row.term}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{row.desc}</span>
        </div>
      </li>
    ))}
  </ul>
);
