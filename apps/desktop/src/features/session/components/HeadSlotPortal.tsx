import { useContext, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SessionHeadSlotsContext } from '../sessionHeadSlotsContext';

type Props = {
  readonly slot: 'title' | 'meta' | 'aside';
  readonly isPageHeading?: boolean;
  readonly children: ReactNode;
};

export const HeadSlotPortal = ({ slot, isPageHeading = slot === 'title', children }: Props) => {
  const slots = useContext(SessionHeadSlotsContext);
  const claim = slots?.claim ?? null;
  const isTitle = slot === 'title';
  useLayoutEffect(() => {
    if (claim === null) {
      return;
    }
    if (isTitle) {
      claim({ part: 'title', isClaimed: true });
    }
    if (isPageHeading) {
      claim({ part: 'heading', isClaimed: true });
    }
    return () => {
      if (isTitle) {
        claim({ part: 'title', isClaimed: false });
      }
      if (isPageHeading) {
        claim({ part: 'heading', isClaimed: false });
      }
    };
  }, [isTitle, isPageHeading, claim]);
  const target = slots === null ? null : slots[slot];
  if (target === null) {
    return null;
  }
  return createPortal(children, target);
};
