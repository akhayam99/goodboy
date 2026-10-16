import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly entries: ReadonlyArray<string>;
  readonly glyph: ReactNode;
};

export const OrchestratedResultGroup = ({ label, entries, glyph }: Props) => {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-row text-muted-foreground">{label}</span>
      <ul aria-label={label} className="flex min-w-0 flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry} className="flex min-w-0 items-start gap-2 text-ui text-foreground">
            <span aria-hidden className="flex h-5 w-3 shrink-0 items-center justify-center">
              {glyph}
            </span>
            <span className="min-w-0 flex-1">{entry}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
