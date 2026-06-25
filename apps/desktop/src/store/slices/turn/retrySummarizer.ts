import type { SessionId } from '@goodboy/types'
import { enqueueSummarizer } from '../../turn-helpers'
import type { GetFn, SetFn } from './types'

export const retrySummarizer = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId) => {
    const status = get().summarizerStatus[sessionId]
    if (!status || status.status === 'running') {
      return
    }
    if (!status.lastAttempt) {
      return
    }
    enqueueSummarizer(
      set,
      get,
      sessionId,
      status.lastAttempt.turnInput,
      status.lastAttempt.turnOutput,
    )
  }
}
