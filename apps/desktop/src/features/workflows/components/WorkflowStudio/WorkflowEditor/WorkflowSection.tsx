import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly help?: string;
  readonly htmlFor?: string;
  readonly children: ReactNode;
};

export const WorkflowSection = ({ label, help, htmlFor, children }: Props) => (
  <section className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 flex-col gap-0.5">
      <h2 className="text-eyebrow text-muted-foreground">
        {htmlFor === undefined ? label : <label htmlFor={htmlFor}>{label}</label>}
      </h2>
      {help === undefined ? null : <p className="text-meta text-faint-foreground">{help}</p>}
    </div>
    {children}
  </section>
);
