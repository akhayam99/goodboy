import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
};

export const PickerSection = ({ label, hint, children }: Props) => (
  <div className="flex flex-col">
    <div className="flex flex-col gap-0.5 px-2.5 pb-1 pt-1.5">
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/80">
        {label}
      </span>
      {hint ? (
        <span className="text-2xs leading-tight text-muted-foreground/60">{hint}</span>
      ) : null}
    </div>
    {children}
  </div>
);
