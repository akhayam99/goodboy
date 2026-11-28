import { useId, type ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly help?: string;
  readonly children: ReactNode;
};

export const FormSection = ({ label, help, children }: Props) => {
  const headingId = useId();
  return (
    <section
      role="group"
      aria-labelledby={headingId}
      data-form-section={label}
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 id={headingId} className="text-eyebrow text-muted-foreground">
          {label}
        </h3>
        {help === undefined ? null : <p className="text-meta text-faint-foreground">{help}</p>}
      </div>
      {children}
    </section>
  );
};
