import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly layout: 'rail' | 'inline';
  readonly children: ReactNode;
};

export const ThreadPropertyRow = ({ label, layout, children }: Props) =>
  layout === 'rail' ? (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Eyebrow label={label} />
      <div className="min-w-0 text-body text-foreground">{children}</div>
    </div>
  ) : (
    <span className="inline-flex min-w-0 items-baseline gap-1 text-meta text-muted-foreground">
      {label}
      <span className="min-w-0 text-foreground">{children}</span>
    </span>
  );
