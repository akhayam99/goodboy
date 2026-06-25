import { acceptSessionNudgeHandoff } from './acceptSessionNudgeHandoff'
import { dismissSessionNudge } from './dismissSessionNudge'
import type { GetFn, SetFn } from './types'

export const createNudgesSlice = (set: SetFn, get: GetFn) => {
  return {
    dismissSessionNudge: dismissSessionNudge(set, get),
    acceptSessionNudgeHandoff: acceptSessionNudgeHandoff(set, get),
  }
}
