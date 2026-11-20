import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PopoverPinContext } from './popoverPinContext';

export type PopoverPinProps = {
  readonly edge: 'start' | 'end';
  readonly children: ReactNode;
  readonly className?: string;
};

export const PopoverPin = ({ edge, children, className }: PopoverPinProps) => {
  const pins = useContext(PopoverPinContext);
  if (pins === null) {
    return <div className={className}>{children}</div>;
  }
  const target = edge === 'start' ? pins.start : pins.end;
  if (target === null) {
    return null;
  }
  return createPortal(<div className={className}>{children}</div>, target);
};
