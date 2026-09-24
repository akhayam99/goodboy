import { Eyebrow } from '@goodboy/ui';
import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const Section = ({ label, children }: Props) => (
  <div className="flex min-w-0 flex-col gap-1">
    <Eyebrow label={label} />
    {children}
  </div>
);
