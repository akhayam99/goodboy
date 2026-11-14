import { useContext, useMemo, type ReactNode } from 'react';
import { SessionHeadSlotsContext, type SessionHeadSlots } from '../sessionHeadSlotsContext';

type Props = {
  readonly isOpen: boolean;
  readonly children: ReactNode;
};

const noClaim = (): void => undefined;

export const HeadSlotsGate = ({ isOpen, children }: Props) => {
  const slots = useContext(SessionHeadSlotsContext);
  const gated = useMemo<SessionHeadSlots | null>(() => {
    if (slots === null || isOpen) {
      return slots;
    }
    return { ...slots, title: null, meta: null, aside: null, claim: noClaim };
  }, [slots, isOpen]);
  return (
    <SessionHeadSlotsContext.Provider value={gated}>{children}</SessionHeadSlotsContext.Provider>
  );
};
