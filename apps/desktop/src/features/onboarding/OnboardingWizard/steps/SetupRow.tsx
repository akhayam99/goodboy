import type { ReactNode } from 'react';

type Props = {
  readonly icon: ReactNode;
  readonly title: string;
  readonly detail: string;
};

export const SetupRow = ({ icon, title, detail }: Props) => {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-soft/40 bg-subtle/20 px-3.5 py-3 text-left">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/40">
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="text-2xs leading-relaxed text-muted-foreground/80">{detail}</span>
      </div>
    </div>
  );
};
