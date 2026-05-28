import type { SetFn } from './types';

export function dismissSystemAlert(set: SetFn) {
  return (id: string) => {
    set((state) => ({
      systemAlerts: state.systemAlerts.filter((a) => a.id !== id),
    }));
  };
}
