import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TabActionsSlotContext } from './tabActionsSlotContext';

type Props = {
  readonly children: ReactNode;
};

export const TabActions = ({ children }: Props) => {
  const slot = useContext(TabActionsSlotContext);
  if (slot === null) {
    return <div className="flex min-w-0 items-center justify-end gap-2">{children}</div>;
  }
  return createPortal(children, slot);
};
