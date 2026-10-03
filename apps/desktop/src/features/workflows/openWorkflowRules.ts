import { useAppStore } from '../../store';

export const openWorkflowRules = (): void => {
  useAppStore.getState().setWorkflowStudioView('rules');
  window.dispatchEvent(new CustomEvent('goodboy:open-workflow-studio'));
};
