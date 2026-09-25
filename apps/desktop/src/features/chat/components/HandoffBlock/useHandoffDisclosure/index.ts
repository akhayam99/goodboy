import { useCallback, useEffect, useState } from 'react';
import type { AgentId, HandoffSectionKind } from '@goodboy/types';
import { HANDOFF_OPEN_EVENT, takeHandoffOpenRequest } from '../handoffOpenRequest';

type Params = {
  readonly agentId: AgentId;
  readonly initiallyOpen: boolean;
};

export type HandoffDisclosure = {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly openSections: ReadonlySet<HandoffSectionKind>;
  readonly toggleSection: (kind: HandoffSectionKind) => void;
  readonly openSection: (kind: HandoffSectionKind) => void;
};

type OpenRequestParams = {
  readonly event: Event;
  readonly agentId: AgentId;
};

const isOpenRequestFor = ({ event, agentId }: OpenRequestParams): boolean =>
  event instanceof CustomEvent &&
  typeof event.detail === 'object' &&
  event.detail !== null &&
  'agentId' in event.detail &&
  event.detail.agentId === agentId;

export const useHandoffDisclosure = ({ agentId, initiallyOpen }: Params): HandoffDisclosure => {
  const [open, setOpen] = useState(() => takeHandoffOpenRequest({ agentId }) || initiallyOpen);
  const [openSections, setOpenSections] = useState<ReadonlySet<HandoffSectionKind>>(
    () => new Set(),
  );

  useEffect(() => {
    const reveal = (event: Event) => {
      if (!isOpenRequestFor({ event, agentId })) {
        return;
      }
      takeHandoffOpenRequest({ agentId });
      setOpen(true);
    };
    window.addEventListener(HANDOFF_OPEN_EVENT, reveal);
    return () => window.removeEventListener(HANDOFF_OPEN_EVENT, reveal);
  }, [agentId]);

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
