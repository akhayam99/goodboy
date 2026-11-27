import {
  bridgeLinkHint,
  bridgePhones,
  type BridgeHint,
  type PairedPhone,
} from '../../../features/companion/bridge';
import { COMPANION_READ_KEY } from './companionReadKey';
import type { CompanionLinkDeps } from './types';

type Read = {
  readonly phones: ReadonlyArray<PairedPhone>;
  readonly hint: BridgeHint;
};

export const readCompanionPhones = ({ set, latest }: CompanionLinkDeps) => {
  return async (): Promise<void> => {
    try {
      await latest.run<Read>({
        key: COMPANION_READ_KEY,
        request: async () => {
          const [phones, hint] = await Promise.all([bridgePhones(), bridgeLinkHint()]);
          if (typeof hint !== 'object' || hint === null) {
            throw new Error('The bridge returned no hint.');
          }
          return { phones: Array.isArray(phones) ? phones : [], hint };
        },
        apply: ({ phones, hint }) =>
          set({ companionPhones: phones, companionHint: hint, companionReadMisses: 0 }),
      });
    } catch {
      set((state) => ({ companionReadMisses: state.companionReadMisses + 1 }));
    }
  };
};
