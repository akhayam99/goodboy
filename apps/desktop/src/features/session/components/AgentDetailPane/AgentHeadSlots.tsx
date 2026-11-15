import { useContext, useLayoutEffect, type ReactNode } from 'react';
import { HeadSlotPortal } from '../HeadSlotPortal';
import { SessionHeadSlotsContext } from '../../sessionHeadSlotsContext';

type Props = {
  readonly title: ReactNode;
  readonly actions: ReactNode;
  readonly isRunStep: boolean;
};

export const AgentHeadSlots = ({ title, actions, isRunStep }: Props) => {
  const claim = useContext(SessionHeadSlotsContext)?.claim ?? null;
  useLayoutEffect(() => {
    if (claim === null) {
      return;
    }
    claim({ part: 'reading', isClaimed: true });
    return () => claim({ part: 'reading', isClaimed: false });
  }, [claim]);
  if (!isRunStep) {
    return <HeadSlotPortal slot="title">{title}</HeadSlotPortal>;
  }
  return (
    <HeadSlotPortal slot="meta" isPageHeading>
      <span className="flex min-w-0 items-center gap-3 text-meta text-muted-foreground">
        {title}
        {actions}
      </span>
    </HeadSlotPortal>
  );
};
