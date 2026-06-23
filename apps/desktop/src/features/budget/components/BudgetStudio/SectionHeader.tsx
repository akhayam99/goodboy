import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly action?: ReactNode;
};

export const SectionHeader = ({ label, hint, action }: Props) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Eyebrow label={label} />
        {action ?? null}
      </div>
      {hint ? <p className="text-2xs text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
};
