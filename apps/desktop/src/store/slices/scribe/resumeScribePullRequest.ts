import { patchScribeWork } from './requestScribe';
import { scribeKeyOf } from './scribeKeyOf';
import type { GetFn, ResumeScribePullRequestInput, SetFn } from './types';

export const resumeScribePullRequest = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    agentId,
    output,
  }: ResumeScribePullRequestInput): Promise<void> => {
    const key = scribeKeyOf({ mountId, kind: 'pr' });
    const existing = get().scribeWork[key];
    if (existing !== undefined && existing.agentId === agentId) {
      patchScribeWork({ set, key, patch: { output } });
    } else {
      set((state) => ({
        scribeAgents: {
          ...Object.fromEntries(
            Object.entries(state.scribeAgents).filter(([, agentKey]) => agentKey !== key),
          ),
          [agentId]: key,
        },
        scribeWork: {
          ...state.scribeWork,
          [key]: {
            key,
            sessionId,
            mountId,
            agentId,
            task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true, base: null },
            status: 'failed',
            output,
            error: null,
            pullRequest: null,
            updatedAt: Date.now(),
          },
        },
      }));
    }
    await get().openScribePullRequest({ key });
  };
};
