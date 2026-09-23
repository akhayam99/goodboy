import { Eyebrow } from '@goodboy/ui';
import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
};

export const PickerSection = ({ label, hint, children }: Props) => (
  <div className="flex flex-col gap-1 py-1.5">
    <div className="flex flex-col gap-0.5 px-2.5">
      <Eyebrow label={label} />
      {hint != null && <span className="text-2xs leading-tight text-faint-foreground">{hint}</span>}
    </div>
    {children}
  </div>
);
