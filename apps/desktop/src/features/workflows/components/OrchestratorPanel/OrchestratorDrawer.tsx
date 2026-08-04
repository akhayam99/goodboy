import type { ReactNode } from 'react';

type Props = {
  readonly inputId: string;
  readonly title: string;
  readonly help: string;
  readonly children: ReactNode;
};

export const OrchestratorDrawer = ({ inputId, title, help, children }: Props) => (
  <div className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-background/40 px-2 py-2">
    <label htmlFor={inputId} className="text-2xs font-semibold text-foreground">
      {title}
    </label>
    <p className="text-2xs leading-relaxed text-muted-foreground">{help}</p>
    {children}
  </div>
);
