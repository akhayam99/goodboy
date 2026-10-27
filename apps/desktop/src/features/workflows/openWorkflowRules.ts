import { useAppStore } from '../../store';
import { dispatchWindowEvent } from '../../shared/lib/dispatchWindowEvent';

export const openWorkflowRules = (): void => {
  useAppStore.getState().setWorkflowStudioView('rules');
  dispatchWindowEvent({ name: 'goodboy:open-workflow-studio' });
};
