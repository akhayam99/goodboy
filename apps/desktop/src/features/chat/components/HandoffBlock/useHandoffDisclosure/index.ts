import { useCallback, useEffect, useState } from 'react';
import type { AgentId, HandoffSectionKind } from '@goodboy/types';
import { HANDOFF_OPEN_EVENT, takeHandoffOpenRequest } from '../handoffOpenRequest';

type Params = {
  readonly agentId: AgentId;
};

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

type InitialState = {
  readonly open: boolean;
  readonly active: HandoffActive;
};

const initialState = ({ agentId }: Params): InitialState => {
  const requested = takeHandoffOpenRequest({ agentId });
  return { open: requested !== null, active: requested };
};

export const useHandoffDisclosure = ({ agentId }: Params): HandoffDisclosure => {
  const [initial] = useState(() => initialState({ agentId }));
  const [open, setOpen] = useState(initial.open);
  const [active, setActive] = useState<HandoffActive>(initial.active);

  useEffect(() => {
    const reveal = (event: Event) => {
      if (!isOpenRequestFor({ event, agentId })) {
        return;
      }
      const requested = takeHandoffOpenRequest({ agentId });
      setOpen(true);
      setActive(requested);
    };
    window.addEventListener(HANDOFF_OPEN_EVENT, reveal);
    return () => window.removeEventListener(HANDOFF_OPEN_EVENT, reveal);
  }, [agentId]);

  const toggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  const toggleChip = useCallback(
    (kind: HandoffSectionKind) => {
      setActive((current) => (open && current === kind ? null : kind));
      setOpen(true);
    },
    [open],
  );

  const showAll = useCallback(() => {
    setOpen(true);
    setActive((current) => (current === 'all' ? null : 'all'));
  }, []);

  const close = useCallback(() => setActive(null), []);

  return { open, toggle, active, setActive, toggleChip, showAll, close };
};
