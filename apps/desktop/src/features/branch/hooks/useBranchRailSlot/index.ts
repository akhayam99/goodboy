import { useContext, useMemo, useState } from 'react';
import { SessionHeadSlotsContext } from '../../../session/sessionHeadSlotsContext';
import type { BranchRailSlot } from '../../branchRailSlotContext';

type Params = {
  readonly isActive: boolean;
};

type BranchRailSlotState = Readonly<{
  railSlot: BranchRailSlot;
  isFramed: boolean;
  setOwnLead: (node: HTMLElement | null) => void;
  setOwnPane: (node: HTMLElement | null) => void;
}>;

export const useBranchRailSlot = ({ isActive }: Params): BranchRailSlotState => {
  const slots = useContext(SessionHeadSlotsContext);
  const [ownLead, setOwnLead] = useState<HTMLElement | null>(null);
  const [ownPane, setOwnPane] = useState<HTMLElement | null>(null);
  const isFramed = slots !== null;
  const host = slots === null ? ownLead : slots.lead;
  const pane = slots === null ? ownPane : slots.frame;
  const railSlot = useMemo(() => ({ host: isActive ? host : null, pane }), [isActive, host, pane]);
  return { railSlot, isFramed, setOwnLead, setOwnPane };
};
