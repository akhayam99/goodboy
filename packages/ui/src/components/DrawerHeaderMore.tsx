import type { ReactNode } from 'react';
import { cn } from '../cn';

type Props = {
  readonly meta: ReactNode;
  readonly metaInsetPx: number;
  readonly toolbar: ReactNode;
};

export const DrawerHeaderMore = ({ meta, metaInsetPx, toolbar }: Props) => (
  <div
    data-drawer-header-more=""
    className={cn('flex min-w-0 flex-col pb-2', toolbar != null && 'gap-2 pt-2')}
  >
    {meta == null ? null : (
      <p
        data-drawer-meta=""
        style={{ paddingLeft: metaInsetPx }}
        className="min-w-0 truncate pr-2 text-meta text-muted-foreground"
      >
        {meta}
      </p>
    )}
    {toolbar == null ? null : (
      <div data-drawer-toolbar="" className="flex min-w-0 flex-col gap-2 px-4">
        {toolbar}
      </div>
    )}
  </div>
);
