import { bridgePhones } from '../../../features/companion/bridge';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';

const KEY = 'companion-phones';

export const readCompanionPhones = ({ set }: SliceDeps) => {
  const latest = createLatestOnly();
  return async (): Promise<void> => {
    try {
      await latest.run({
        key: KEY,
        request: async () => {
          const phones = await bridgePhones();
          return { phones: Array.isArray(phones) ? phones : [] };
        },
        apply: ({ phones }) => set({ companionPhones: phones, companionReadMisses: 0 }),
      });
    } catch {
      set((state) => ({ companionReadMisses: state.companionReadMisses + 1 }));
    }
  };
};
