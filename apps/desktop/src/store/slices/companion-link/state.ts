import type { BridgeHint, BridgeStatus, PairedPhone } from '../../../features/companion/bridge';

export type CompanionLinkState = {
  readonly companionStatus: BridgeStatus | null;
  readonly companionPhones: ReadonlyArray<PairedPhone>;
  readonly companionHint: BridgeHint | null;
  readonly companionReadMisses: number;
  readonly isCompanionPageOpen: boolean;
};

export const companionLinkInitialState: CompanionLinkState = {
  companionStatus: null,
  companionPhones: [],
  companionHint: null,
  companionReadMisses: 0,
  isCompanionPageOpen: false,
};
