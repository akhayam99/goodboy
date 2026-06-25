import type { GhTokenStatus } from '@goodboy/types'
import { ghSetToken } from '../../../features/github/github'
import type { SetFn } from './types'

export const setGithubPat = (set: SetFn) => {
  return async (token: string): Promise<GhTokenStatus> => {
    const status = await ghSetToken(token)
    set({ githubStatus: status })
    return status
  }
}
