import { useAppStore } from '../../../../../store';
import { seedBrandLimits } from '../brand/limitsSeed';
import { SESSION_ID } from '../activityRunSeed';
import { seedHeroAgents } from './seedHeroAgents';

const settleReviewThreads = (): void => {
  useAppStore.setState((state) => ({
    sessionResolveQueueItems: {
      ...state.sessionResolveQueueItems,
      [SESSION_ID]: (state.sessionResolveQueueItems[SESSION_ID] ?? []).map((row) =>
        row.thread.state === 'fixed' || row.thread.state === 'failed'
          ? { ...row, thread: { ...row.thread, state: 'closed', stage: 'resolved' } }
          : row,
      ),
    },
  }));
};

export const seedReadmeHeroLog = (): void => {
  seedBrandLimits();
  seedHeroAgents();
  settleReviewThreads();
};
