import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const SavedStepSection = ({ label, children }: Props) => (
  <section aria-label={label} className="flex min-w-0 flex-col gap-1">
    <h3 className="px-2 text-meta font-semibold uppercase tracking-eyebrow text-faint-foreground">
      {label}
    </h3>
    <ul className="flex flex-col">{children}</ul>
  </section>
);
