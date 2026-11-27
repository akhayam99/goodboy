import {
  bridgePhones,
  bridgeStatus,
  type BridgeStatus,
  type PairedPhone,
} from '../../../features/companion/bridge';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';

const KEY = 'companion-link';

type Read = {
  readonly status: BridgeStatus;
  readonly phones: ReadonlyArray<PairedPhone>;
};

export const refreshCompanionLink = ({ set }: SliceDeps) => {
  const latest = createLatestOnly();
  return async (): Promise<boolean> => {
    try {
      const outcome = await latest.run<Read>({
        key: KEY,
        request: async () => {
          const [status, phones] = await Promise.all([bridgeStatus(), bridgePhones()]);
          if (typeof status !== 'object' || status === null) {
            throw new Error('The bridge returned no status.');
          }
          return { status, phones: Array.isArray(phones) ? phones : [] };
        },
        apply: ({ status, phones }) =>
          set({ companionStatus: status, companionPhones: phones, companionReadMisses: 0 }),
      });
      return outcome === 'applied';
    } catch {
      set((state) => ({ companionReadMisses: state.companionReadMisses + 1 }));
      return false;
    }
  };
};
