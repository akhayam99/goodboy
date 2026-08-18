import type { ReactNode } from 'react';
import { SectionSurface } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const ResolverPanelSection = ({ label, children }: Props) => (
  <SectionSurface label={label}>{children}</SectionSurface>
);
