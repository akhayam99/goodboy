import { useContext, useMemo, useState } from 'react';
import { SessionHeadSlotsContext } from '../../../session/sessionHeadSlotsContext';

type Params = {
  readonly isActive: boolean;
};

type RailSlot = Readonly<{
  host: HTMLElement;
  pane: HTMLElement;
  isShown: boolean;
}>;

type BranchRailSlot = Readonly<{
  railSlot: RailSlot | null;
  isFramed: boolean;
  setOwnLead: (node: HTMLElement | null) => void;
  setOwnPane: (node: HTMLElement | null) => void;
}>;

export const useBranchRailSlot = ({ isActive }: Params): BranchRailSlot => {
  const slots = useContext(SessionHeadSlotsContext);
  const [ownLead, setOwnLead] = useState<HTMLElement | null>(null);
  const [ownPane, setOwnPane] = useState<HTMLElement | null>(null);
  const isFramed = slots !== null;
  const host = slots === null ? ownLead : slots.lead;
  const pane = slots === null ? ownPane : slots.frame;
  const railSlot = useMemo(
    () => (host === null || pane === null ? null : { host, pane, isShown: isActive }),
    [isActive, host, pane],
  );
  return { railSlot, isFramed, setOwnLead, setOwnPane };
};
