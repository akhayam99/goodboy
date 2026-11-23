import { WIZARD_WINDOW_DECISION } from '../../features/onboarding/OnboardingWizard/wizardWindowDecision';
import { importStoreModule, pristineActions, resetStorySpies } from './spies';

export const resetStoryStore = async () => {
  const { useAppStore } = await importStoreModule();
  resetStorySpies();
  WIZARD_WINDOW_DECISION.hasDecided = false;
  useAppStore.setState({
    ...pristineActions.get(useAppStore),
    ...useAppStore.getInitialState(),
  });
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }
};
