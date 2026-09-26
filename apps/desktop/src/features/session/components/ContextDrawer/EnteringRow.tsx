import { useEffect, useState, type ReactNode } from 'react';
import { Reveal } from '@goodboy/ui';

type Props = {
  readonly isEntering: boolean;
  readonly children: ReactNode;
};

export const EnteringRow = ({ isEntering, children }: Props) => {
  const [isOpen, setIsOpen] = useState(!isEntering);

  useEffect(() => {
    if (isOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => setIsOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  return <Reveal open={isOpen}>{children}</Reveal>;
};
