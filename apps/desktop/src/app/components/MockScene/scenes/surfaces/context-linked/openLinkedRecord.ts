import { useAppStore } from '../../../../../../store';
import { SESSION_ID } from '../../activityRunSeed';

type Params = Record<string, never>;

export const openLinkedRecord = ({}: Params) => {
  const state = useAppStore.getState();
  const task = state.sessionExternalTasks[SESSION_ID]?.find((row) => row.provider === 'linear');
  if (task === undefined) {
    return;
  }
  useAppStore.setState({
    activeLens: { ...state.activeLens, [SESSION_ID]: 'linear' },
    selectedAgentId: { ...state.selectedAgentId, [SESSION_ID]: null },
    focusedExternalTask: {
      ...state.focusedExternalTask,
      [SESSION_ID]: { provider: 'linear', externalId: task.externalId, projectId: null },
    },
  });
};
