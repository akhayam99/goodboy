import { useMemo } from 'react'
import type { Session, SessionId } from '@goodboy/types'
import { useAppStore } from '../../../../../store'
import { openInEditor } from '../../../../../shared/lib/editor'
import { markStepComplete } from '../../../../onboarding/onboarding-store'

export type BoardNavigation = {
  readonly selectCard: (session: Session) => void
  readonly openAgent: (session: Session) => void
  readonly openDiff: (session: Session) => void
  readonly openTerminal: (session: Session) => void
  readonly openIDE: (session: Session) => void
  readonly restore: (session: Session) => void
}

export const useBoardNavigation = (): BoardNavigation => {
  const setCurrentSession = useAppStore((s) => s.setCurrentSession)
  const setActiveLens = useAppStore((s) => s.setActiveLens)
  const selectAgent = useAppStore((s) => s.selectAgent)
  const unarchiveTask = useAppStore((s) => s.unarchiveTask)

  return useMemo<BoardNavigation>(() => {
    const selectCard = (session: Session): void => {
      const id = session.id as SessionId
      void setCurrentSession(id).then(() => {
        setActiveLens(id, null)
      })
      markStepComplete('session')
    }

    const openAgent = (session: Session): void => {
      const id = session.id as SessionId
      void setCurrentSession(id).then(() => {
        const agent = (useAppStore.getState().sessionPhaseRuns[id] ?? [])[0]
        if (agent) {
          void selectAgent(id, agent.id)
        }
        window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'))
      })
    }

    const openDiff = (session: Session): void => {
      const id = session.id as SessionId
      void setCurrentSession(id).then(() => {
        window.dispatchEvent(
          new CustomEvent('goodboy:open-diff-viewer', { detail: { sessionId: id } }),
        )
      })
    }

    const openTerminal = (session: Session): void => {
      const id = session.id as SessionId
      void setCurrentSession(id).then(() => {
        setActiveLens(id, 'terminal')
      })
    }

    const openIDE = (session: Session): void => {
      const path = useAppStore.getState().sessionWorktrees[session.id]?.[0]
      if (path) {
        void openInEditor(path)
      }
    }

    const restore = (session: Session): void => {
      void unarchiveTask(session.id as SessionId)
    }

    return { selectCard, openAgent, openDiff, openTerminal, openIDE, restore }
  }, [setCurrentSession, setActiveLens, selectAgent, unarchiveTask])
}
