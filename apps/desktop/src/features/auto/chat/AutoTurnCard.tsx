import type { ReactNode } from 'react';
import type { AutoDelegation } from '@goodboy/db';
import { cn } from '@goodboy/ui';
import { autoCardHeadOf } from './autoCardHeadOf';

type Props = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly children: ReactNode;
};

export const AutoTurnCard = ({ delegations, children }: Props) => {
  const head = autoCardHeadOf({ delegations });
  return (
    <section
      data-turn=""
      data-soft-card=""
      aria-label={head.name}
      className="flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4"
    >
      <div className="flex min-h-6 min-w-0 items-center gap-2">
        <span className="text-row text-foreground">{head.name}</span>
        <span className="min-w-0 truncate text-meta text-faint-foreground">{head.meta}</span>
        <span className="flex-1" />
        <span
          className={cn(
            'shrink-0 text-meta',
            head.isOpen ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {head.word}
        </span>
      </div>
      {children}
    </section>
  );
};
