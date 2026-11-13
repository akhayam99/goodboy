import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { ICON_SIZE } from '../../iconSize';

type Props = {
  readonly label: ReactNode;
  readonly isOpenAtStart: boolean;
  readonly children: ReactNode;
};

export const DetailsBlock = ({ label, isOpenAtStart, children }: Props) => (
  <details
    data-testid="markdown-details"
    open={isOpenAtStart}
    className="group flex min-w-0 flex-col"
  >
    <summary
      className={cn(
        'flex w-fit min-w-0 max-w-full cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 text-left text-body text-foreground marker:content-none hover:bg-hover group-open:bg-hover [&::-webkit-details-marker]:hidden',
        FOCUS_RING,
      )}
    >
      <ChevronRight
        size={ICON_SIZE.control}
        aria-hidden
        className="shrink-0 text-faint-foreground motion-safe:transition-transform group-open:rotate-90"
      />
      {label}
    </summary>
    <div className="flex min-w-0 flex-col gap-2 pl-[calc(8px+14px+8px)] pr-2 text-prose text-foreground wrap-anywhere">
      {children}
    </div>
  </details>
);
