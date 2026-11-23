import { WIZARD_WINDOW_DECISION } from '../../features/onboarding/OnboardingWizard/wizardWindowDecision';
import { importStoreModule, pristineActions, resetStorySpies } from './spies';

export const resetStoryStore = async () => {
  const { useAppStore } = await importStoreModule();
  const { forgetSavedQueues } = await import('../../store/slices/agentQueue/queueStore');
  resetStorySpies();
  forgetSavedQueues();
  WIZARD_WINDOW_DECISION.hasDecided = false;
  useAppStore.setState({
    ...pristineActions.get(useAppStore),
    ...useAppStore.getInitialState(),
  });
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }
};
