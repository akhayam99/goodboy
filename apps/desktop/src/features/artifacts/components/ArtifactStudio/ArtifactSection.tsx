import { Eyebrow } from '@goodboy/ui';
import type { ReactNode } from 'react';

type Props = {
  readonly heading: string;
  readonly children: ReactNode;
};

export const ArtifactSection = ({ heading, children }: Props) => (
  <section className="flex flex-col gap-2" aria-label={heading} data-testid="artifact-section">
    <h2>
      <Eyebrow label={heading} muted />
    </h2>
    {children}
  </section>
);
