import type { SessionId } from '@goodboy/types'
import { listOpenQuestionsForSession } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { SetFn } from './types'

export const loadSessionAnsweredQuestions = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const questions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'answered')
    set((state) => ({
      sessionAnsweredQuestions: { ...state.sessionAnsweredQuestions, [sessionId]: questions },
    }))
  }
}
