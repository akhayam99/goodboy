import { listArtifactsForSession } from '../../../features/artifacts/artifacts';
import { listPlansForSession } from '../../../features/plans/plans';
import type { GetFn, SetFn } from '../../slice-types';
import { createLatestOnly } from '../state-writes/latestOnly';
import type { RefreshSessionArtifactsParams } from './ports';

type Params = {
  readonly get: GetFn;
  readonly set: SetFn;
};

export const makeRefreshSessionArtifacts = ({ get, set }: Params) => {
  const latest = createLatestOnly();
  return async ({ sessionId }: RefreshSessionArtifactsParams): Promise<void> => {
    try {
      await latest.run({
        key: sessionId,
        request: () =>
          Promise.all([listPlansForSession(sessionId), listArtifactsForSession(sessionId)]),
        apply: ([plans, artifacts]) => {
          set((state) => ({
            sessionPlans: { ...state.sessionPlans, [sessionId]: plans },
            sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: artifacts },
          }));
        },
      });
    } catch (error) {
      await get().reportError({ title: "Couldn't refresh the plans", error, sessionId });
    }
  };
};
