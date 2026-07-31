import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly children: ReactNode;
};

export const LegendBlock = ({ title, children }: Props) => (
  <div className="flex flex-col gap-2.5 rounded-lg border border-border-soft bg-subtle/40 p-4">
    <Eyebrow label={title} />
    {children}
  </div>
);
