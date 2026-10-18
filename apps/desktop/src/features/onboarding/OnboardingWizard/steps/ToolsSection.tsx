import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const ToolsSection = ({ label, children }: Props) => (
  <section aria-label={label} className="flex flex-col gap-2">
    <Eyebrow label={label} />
    {children}
  </section>
);
