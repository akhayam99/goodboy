import type { PrWriteAnnouncement } from '../../../features/review/prWriteBus';
import type { SetFn } from './types';

export const notePrWrite = (set: SetFn) => {
  return (announcement: PrWriteAnnouncement): void => {
    set((state) => {
      const current = state.prWriteClaims[announcement.key];
      if (announcement.kind === 'released') {
        if (current === undefined || current.token !== announcement.token) {
          return {};
        }
        const next = { ...state.prWriteClaims };
        delete next[announcement.key];
        return { prWriteClaims: next };
      }
      if (current !== undefined && current.token === announcement.token) {
        return {};
      }
      return {
        prWriteClaims: {
          ...state.prWriteClaims,
          [announcement.key]: {
            key: announcement.key,
            token: announcement.token,
            windowLabel: announcement.windowLabel,
            action: announcement.action,
            startedAt: announcement.startedAt,
          },
        },
      };
    });
  };
};
