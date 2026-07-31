import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone as SharedTone } from '@goodboy/ui';

type Tone = Extract<SharedTone, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>;

type DefinitionRow = {
  readonly term: string;
  readonly desc: string;
  readonly icon?: ReactNode;
  readonly tone?: Tone;
};

type Props = {
  readonly rows: ReadonlyArray<DefinitionRow>;
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
              'flex size-5 shrink-0 items-center justify-center',
              tintClasses(row.tone ?? 'neutral').text,
            )}
          >
            {row.icon}
          </span>
        ) : (
          <span
            className={cn(
              'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
              tintClasses(row.tone ?? 'neutral').dot,
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
