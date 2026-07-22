import type { ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';

type Props = {
  readonly title: string;
  readonly children: ReactNode;
};

export const Block = ({ title, children }: Props) => (
  <div className="flex flex-col gap-3">
    <Eyebrow>{title}</Eyebrow>
    {children}
  </div>
);
