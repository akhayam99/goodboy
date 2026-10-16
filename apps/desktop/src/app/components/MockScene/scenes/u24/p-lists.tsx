import type { AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ActivityRunScene } from '../ActivityRunScene';
import { SESSION_ID } from '../activityRunSeed';
import { InboxScene } from '../InboxScene';
import { NotificationsScene } from '../audit/NotificationsScene';

const DELETE_ALL_CLICKS: ReadonlyArray<string> = ['Open all', 'Delete all'];

const UNSEEN_AGENT_ID = 'mock-run-agent-banner-copy' as AgentId;

const markOneAgentUnseen = () => {
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION_ID]: (state.sessionPhaseRuns[SESSION_ID] ?? []).map((agent) =>
        agent.id === UNSEEN_AGENT_ID
          ? { ...agent, lastViewedAt: agent.startedAt, doneAt: undefined }
          : agent,
      ),
    },
  }));
};

export const U24_P_LISTS_SCENES = {
  'notifications-delete-all': () => <NotificationsScene openLabels={DELETE_ALL_CLICKS} />,
  'activity-mark-seen': () => <ActivityRunScene onSeeded={markOneAgentUnseen} />,
  'tasks-cursor': () => <InboxScene isDrawerClosed />,
};
