import { useCallback, useState } from 'react';
import type { HandoffSectionKind } from '@goodboy/types';

type Params = {
  readonly initiallyOpen: boolean;
};

export type HandoffDisclosure = {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly openSections: ReadonlySet<HandoffSectionKind>;
  readonly toggleSection: (kind: HandoffSectionKind) => void;
  readonly openSection: (kind: HandoffSectionKind) => void;
};

export const useHandoffDisclosure = ({ initiallyOpen }: Params): HandoffDisclosure => {
  const [open, setOpen] = useState(initiallyOpen);
  const [openSections, setOpenSections] = useState<ReadonlySet<HandoffSectionKind>>(
    () => new Set(),
  );

  const toggle = useCallback(() => setOpen((value) => !value), []);

  const toggleSection = useCallback((kind: HandoffSectionKind) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(kind)) {
        next.delete(kind);
        return next;
      }
      next.add(kind);
      return next;
    });
  }, []);

  const openSection = useCallback((kind: HandoffSectionKind) => {
    setOpen(true);
    setOpenSections((current) => (current.has(kind) ? current : new Set([...current, kind])));
  }, []);

  return { open, toggle, openSections, toggleSection, openSection };
};
