import { CornerUpLeft } from 'lucide-react';
import { Button, ICON_SIZE, formatUsd } from '@goodboy/ui';
import type { DelegationCardModel } from './delegationCardOf';

type Props = {
  readonly card: DelegationCardModel;
  readonly onOpenChat: (card: DelegationCardModel) => void;
};

export const DelegationCardFooter = ({ card, onOpenChat }: Props) => {
  if (card.isOpen) {
    return card.ceilingUsd === null ? null : (
      <p className="text-meta text-faint-foreground">Reserved up to {formatUsd(card.ceilingUsd)}</p>
    );
  }
  const cost = card.result?.costUsd ?? null;
  return (
    <div className="flex min-w-0 items-center gap-2 text-meta text-faint-foreground">
      <CornerUpLeft size={ICON_SIZE.control} aria-hidden className="shrink-0" />
      <span className="shrink-0">Returned to Auto</span>
      {cost === null ? null : (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            {card.result?.isCostEstimated === true ? 'about ' : ''}
            {formatUsd(cost)}
          </span>
        </>
      )}
      <span aria-hidden className="min-w-0 flex-1" />
      <Button variant="ghost" size="xs" onClick={() => onOpenChat(card)}>
        Open chat
      </Button>
    </div>
  );
};
