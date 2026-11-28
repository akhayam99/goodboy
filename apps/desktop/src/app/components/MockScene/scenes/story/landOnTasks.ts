import { useAppStore } from '../../../../../store';
import { installStoryFlow } from '../../demo/director/installStoryFlow';
import { seedStoryWorld } from './storyWorld';

export const landOnTasks = (): void => {
  const initial = useAppStore.getInitialState();
  const wizardIntegrations = useAppStore.getState().workspaceIntegrations;
  useAppStore.setState({
    providers: initial.providers,
    providerStatus: initial.providerStatus,
    codexStatus: initial.codexStatus,
    cursorStatus: initial.cursorStatus,
    geminiStatus: initial.geminiStatus,
    authResults: initial.authResults,
    providerConnect: initial.providerConnect,
    probeAgent: initial.probeAgent,
    refreshProviders: initial.refreshProviders,
    connectProvider: initial.connectProvider,
    cancelProviderConnect: initial.cancelProviderConnect,
    setCurrentWorkspace: initial.setCurrentWorkspace,
    startSessionFromDraft: initial.startSessionFromDraft,
    openSessionDraft: initial.openSessionDraft,
  });
  seedStoryWorld({ stage: 'tasks' });
  useAppStore.setState((state) => ({
    workspaceIntegrations: { ...wizardIntegrations, ...state.workspaceIntegrations },
  }));
  installStoryFlow({ store: useAppStore });
};
