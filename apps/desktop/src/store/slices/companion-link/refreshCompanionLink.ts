import {
  bridgePhones,
  bridgeStatus,
  type BridgeStatus,
  type PairedPhone,
} from '../../../features/companion/bridge';
import type { CompanionLinkDeps } from './types';
import { COMPANION_READ_KEY } from './companionReadKey';

type Read = {
  readonly status: BridgeStatus;
  readonly phones: ReadonlyArray<PairedPhone>;
};

export const refreshCompanionLink = ({ set, latest }: CompanionLinkDeps) => {
  return async (): Promise<boolean> => {
    try {
      const outcome = await latest.run<Read>({
        key: COMPANION_READ_KEY,
        request: async () => {
          const [status, phones] = await Promise.all([bridgeStatus(), bridgePhones()]);
          if (typeof status !== 'object' || status === null) {
            throw new Error('The bridge returned no status.');
          }
          return { status, phones: Array.isArray(phones) ? phones : [] };
        },
        apply: ({ status, phones }) =>
          set({
            companionStatus: status,
            companionPhones: phones,
            companionHint: {
              priorPhoneCount: status.priorPhoneCount ?? phones.length,
              fault: status.fault,
            },
            companionReadMisses: 0,
          }),
      });
      return outcome === 'applied';
    } catch {
      set((state) => ({ companionReadMisses: state.companionReadMisses + 1 }));
      return false;
    }
  };
};
