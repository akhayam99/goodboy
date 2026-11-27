import type { BridgeStatus, PairedPhone } from '../../../features/companion/bridge';

export type CompanionLinkState = {
  readonly companionStatus: BridgeStatus | null;
  readonly companionPhones: ReadonlyArray<PairedPhone>;
  readonly companionReadMisses: number;
  readonly isCompanionPageOpen: boolean;
};

export const companionLinkInitialState: CompanionLinkState = {
  companionStatus: null,
  companionPhones: [],
  companionReadMisses: 0,
  isCompanionPageOpen: false,
};
