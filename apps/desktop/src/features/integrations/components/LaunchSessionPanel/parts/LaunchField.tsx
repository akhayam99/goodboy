import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly icon: ReactNode;
  readonly children: ReactNode;
};

export const LaunchField = ({ label, icon, children }: Props) => (
  <div className="flex flex-col gap-1.5">
    <SectionHeader label={label} icon={icon} />
    {children}
  </div>
);
