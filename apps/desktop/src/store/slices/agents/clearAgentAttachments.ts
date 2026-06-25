import type { AgentId } from '@goodboy/types'
import type { SetFn } from './types'

export const clearAgentAttachments = (set: SetFn) => {
  return (agentId: AgentId) => {
    set((s) => {
      if (!(agentId in s.agentAttachments)) {
        return s
      }
      const next = { ...s.agentAttachments }
      delete next[agentId]
      return { agentAttachments: next }
    })
  }
}
