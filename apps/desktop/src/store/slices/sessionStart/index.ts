import { closeSessionSetupStep } from './closeSessionSetupStep';
import { focusSessionSetupStep } from './focusSessionSetupStep';
import { saveSessionSetupGoal } from './saveSessionSetupGoal';
import { skipSessionSetupStep } from './skipSessionSetupStep';
import { startBlankSession } from './startBlankSession';
import type { GetFn, SetFn } from './types';

export const createSessionStartSlice = (set: SetFn, get: GetFn) => {
  return {
    startBlankSession: startBlankSession(set, get),
    saveSessionSetupGoal: saveSessionSetupGoal(set, get),
    skipSessionSetupStep: skipSessionSetupStep(set),
    focusSessionSetupStep: focusSessionSetupStep(set),
    closeSessionSetupStep: closeSessionSetupStep(set),
  };
};
