import { useCallback } from 'react'
import type { SessionId } from '@goodboy/types'
import { useAppStore } from '../../../store'

export const useOpenSession = (): ((sessionId: SessionId, onOpened?: () => void) => void) => {
  const setCurrentSession = useAppStore((s) => s.setCurrentSession)
  return useCallback(
    (sessionId: SessionId, onOpened?: () => void) => {
      void setCurrentSession(sessionId)
      onOpened?.()
    },
    [setCurrentSession],
  )
}
