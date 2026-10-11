import { useMemo, useState, type ReactNode } from 'react';
import { DiffRailContext, type DiffRailHost } from '../../features/diff/diffRailHost';

type Props = {
  readonly isOverlay: boolean;
  readonly children: ReactNode;
};

export const DiffRailHarness = ({ isOverlay, children }: Props) => {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(!isOverlay);
  const slot = useMemo<DiffRailHost>(
    () => ({
      host,
      isOverlay,
      open: () => setIsOpen(true),
      dismiss: () => {
        if (isOverlay) {
          setIsOpen(false);
        }
      },
    }),
    [host, isOverlay],
  );
  return (
    <DiffRailContext.Provider value={slot}>
      {isOpen ? <aside aria-label="Branch sections" data-testid="rail-host" ref={setHost} /> : null}
      {children}
    </DiffRailContext.Provider>
  );
};
