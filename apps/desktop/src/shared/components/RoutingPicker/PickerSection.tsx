import { Eyebrow } from '@goodboy/ui';
import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export const PickerSection = ({ label, hint, action, children }: Props) => (
  <div className="flex flex-col gap-1 py-1.5">
    <div className="flex flex-col gap-0.5 px-2.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Eyebrow label={label} />
        {action}
      </div>
      {hint != null && <span className="text-2xs leading-tight text-faint-foreground">{hint}</span>}
    </div>
    {children}
  </div>
);
