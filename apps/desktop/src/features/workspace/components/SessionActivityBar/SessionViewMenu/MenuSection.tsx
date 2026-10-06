import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly children: ReactNode;
};

export const MenuSection = ({ title, children }: Props) => (
  <div role="group" aria-label={title} className="flex flex-col px-1 py-1">
    <Eyebrow label={title} muted className="px-2 pb-1 pt-0.5" />
    {children}
  </div>
);
