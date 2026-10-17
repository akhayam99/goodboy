import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly trailing: ReactNode;
};

export const BriefHeader = ({ label, trailing }: Props) => (
  <header className="flex min-h-6 items-center gap-2">
    <Eyebrow label={label} className="min-w-0 flex-1 truncate" />
    {trailing}
  </header>
);
