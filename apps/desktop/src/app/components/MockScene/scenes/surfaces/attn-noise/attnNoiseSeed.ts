import { useAppStore } from '../../../../../../store';
import { SESSION, seedActivityRunScene } from '../../activityRunSeed';

export const ATTN_NOISE_SESSION = SESSION;

export const seedAttnNoiseScene = (): void => {
  seedActivityRunScene();
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION.id]: (state.sessionPhaseRuns[SESSION.id] ?? []).map((agent) => {
        const { lastViewedAt: _viewedAt, ...unread } = agent;
        return agent.lastFinishedAt === undefined ? agent : unread;
      }),
    },
  }));
};
