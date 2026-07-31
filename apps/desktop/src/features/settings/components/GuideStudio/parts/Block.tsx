import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly children: ReactNode;
};

export const Block = ({ title, children }: Props) => (
  <div className="flex flex-col gap-3">
    <Eyebrow label={title} />
    {children}
  </div>
);
