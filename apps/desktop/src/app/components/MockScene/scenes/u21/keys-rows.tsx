import type { AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ActivityRunScene } from '../ActivityRunScene';
import { SESSION_ID } from '../activityRunSeed';

const UNREAD_AGENT_ID = 'mock-run-agent-banner-copy' as AgentId;

const markOneRowUnread = () => {
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION_ID]: (state.sessionPhaseRuns[SESSION_ID] ?? []).map((agent) =>
        agent.id === UNREAD_AGENT_ID ? { ...agent, lastViewedAt: agent.startedAt } : agent,
      ),
    },
  }));
};

const ActivityRunHoverScene = () => <ActivityRunScene onSeeded={markOneRowUnread} />;

export const U21_KEYS_ROWS_SCENES = {
  'activity-run-hover': ActivityRunHoverScene,
};
