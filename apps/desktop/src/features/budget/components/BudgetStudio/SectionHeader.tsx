import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly action?: ReactNode;
};

export function SectionHeader({ label, hint, action }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {action ?? null}
      </div>
      {hint ? <p className="text-2xs text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}
