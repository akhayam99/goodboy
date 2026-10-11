import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly count: number;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export const ScriptBand = ({ label, count, hint, action, children }: Props) => (
  <section aria-label={label} className="flex flex-col gap-1">
    <SectionHeader
      label={label}
      hint={hint}
      action={action}
      meta={<span className="text-meta tabular-nums text-faint-foreground">{count}</span>}
      className="px-2"
    />
    <div className="flex flex-col gap-0.5">{children}</div>
  </section>
);
