import type { SetFn } from './types'

export const dismissSystemAlert = (set: SetFn) => {
  return (id: string) => {
    set((state) => ({
      systemAlerts: state.systemAlerts.filter((a) => a.id !== id),
    }))
  }
}
