import { useCallback, useState } from 'react';
import type { HandoffSectionKind } from '@goodboy/types';

export type HandoffActive = HandoffSectionKind | 'all' | null;

export type HandoffDisclosure = {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly active: HandoffActive;
  readonly setActive: (value: HandoffActive) => void;
  readonly toggleChip: (kind: HandoffSectionKind) => void;
  readonly showAll: () => void;
  readonly close: () => void;
};

export const useHandoffDisclosure = (): HandoffDisclosure => {
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState<HandoffActive>(null);

  const toggle = useCallback(() => {
    setIsOpen((wasOpen) => !wasOpen);
  }, []);

  const toggleChip = useCallback(
    (kind: HandoffSectionKind) => {
      setActive((current) => (isOpen && current === kind ? null : kind));
      setIsOpen(true);
    },
    [isOpen],
  );

  const showAll = useCallback(() => {
    setIsOpen(true);
    setActive((current) => (current === 'all' ? null : 'all'));
  }, []);

  const close = useCallback(() => setActive(null), []);

  return { open: isOpen, toggle, active, setActive, toggleChip, showAll, close };
};
