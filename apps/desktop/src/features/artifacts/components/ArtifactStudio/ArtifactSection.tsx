import type { ReactNode } from 'react';

type Props = {
  readonly heading: string;
  readonly children: ReactNode;
};

export const ArtifactSection = ({ heading, children }: Props) => (
  <section className="flex flex-col gap-2" aria-label={heading} data-testid="artifact-section">
    <h2 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
      {heading}
    </h2>
    {children}
  </section>
);
