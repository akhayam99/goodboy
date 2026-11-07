import type { ReactNode } from 'react';
import type { AutoDelegation } from '@goodboy/db';
import { cn } from '@goodboy/ui';
import type { InsertionReply } from '../../../shared/types/transcriptInsertion';
import { AutoCardReply } from './AutoCardReply';
import { autoCardHeadOf } from './autoCardHeadOf';

type Props = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly replies?: ReadonlyArray<InsertionReply>;
  readonly children: ReactNode;
};

export const AutoTurnCard = ({ delegations, replies = [], children }: Props) => {
  const head = autoCardHeadOf({ delegations });
  return (
    <div
      role="group"
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
            head.word === 'Failed'
              ? 'text-danger'
              : head.word === 'Needs you'
                ? 'text-warning'
                : head.isOpen
                  ? 'text-foreground'
                  : 'text-muted-foreground',
          )}
        >
          {head.word}
        </span>
      </div>
      {replies.map((reply) => (
        <AutoCardReply key={reply.key} reply={reply} />
      ))}
      {children}
    </div>
  );
};
