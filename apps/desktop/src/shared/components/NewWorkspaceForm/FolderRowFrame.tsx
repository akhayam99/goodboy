import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly name: string;
  readonly path: string;
  readonly icon: ReactNode;
  readonly meta: ReactNode;
  readonly lead?: ReactNode;
  readonly trailing?: ReactNode;
  readonly notice?: ReactNode;
  readonly isDimmed?: boolean;
};

export const FolderRowFrame = ({
  name,
  path,
  icon,
  meta,
  lead = null,
  trailing = null,
  notice = null,
  isDimmed = false,
}: Props) => (
  <li className="flex flex-col bg-subtle motion-safe:animate-fade-in">
    <div className="flex min-h-14 items-center gap-3 py-2 pl-4 pr-3">
      {lead}
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center text-faint-foreground',
          isDimmed && 'opacity-55',
        )}
      >
        {icon}
      </span>
      <span className={cn('flex min-w-0 flex-1 flex-col', isDimmed && 'opacity-55')}>
        <span className="truncate text-row text-foreground">{name}</span>
        <span className="truncate text-code text-faint-foreground">{path}</span>
      </span>
      <span className={cn('flex shrink-0 items-center gap-1', isDimmed && 'opacity-55')}>
        {meta}
      </span>
      {trailing}
    </div>
    {notice === null ? null : <div className="pb-3 pl-12 pr-3">{notice}</div>}
  </li>
);
