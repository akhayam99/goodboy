import type { ReactNode } from 'react';
import { Eyebrow } from '../Eyebrow';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const FacetSection = ({ label, children }: Props) => (
  <div role="group" aria-label={label} className="flex flex-col gap-0.5">
    <Eyebrow label={label} muted className="px-2 pb-1" />
    {children}
  </div>
);
