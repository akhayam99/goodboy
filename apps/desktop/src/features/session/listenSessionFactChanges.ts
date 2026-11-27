import { listenDataChanged } from '../../shared/lib/dataChanged';
import { useAppStore } from '../../store';

export const listenSessionFactChanges = (): Promise<() => void> =>
  listenDataChanged({
    onChange: ({ kind, sessionId }) => {
      const state = useAppStore.getState();
      if (kind === 'open-question') {
        void state.loadSessionOpenQuestions(sessionId);
        if (state.sessionAnsweredQuestions[sessionId] !== undefined) {
          void state.loadSessionAnsweredQuestions(sessionId);
        }
        if (state.sessionDismissedQuestions[sessionId] !== undefined) {
          void state.loadSessionDismissedQuestions(sessionId);
        }
        return;
      }
      if (kind === 'slack-draft') {
        if (state.sessionSlackDrafts[sessionId] !== undefined) {
          void state.loadSessionSlackDrafts(sessionId);
        }
        return;
      }
      if (kind === 'agent-seen' && state.sessionPhaseRuns[sessionId] !== undefined) {
        void state.refreshAgentsSeen({ sessionId });
      }
    },
  });
