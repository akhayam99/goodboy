import { useEffect, useState, type ComponentType } from 'react';
import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { installSettingsInvokeMocks } from '../audit/installSettingsInvokeMocks';
import { OverrideOffNoteScene } from './OverrideOffNoteScene';

const OPEN_DELAY_MS = 30;

const SAVED_PROJECTS = 2;

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

type ProviderParams = {
  readonly id: ProviderId;
  readonly label: string;
  readonly binary: string;
};

const connected = ({ id, label, binary }: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary,
  capabilities: CAPABILITIES,
  connection: 'connected',
  version: '2.1.290',
  identity: 'mara.quint@harborline.dev',
  label,
  error: null,
  docsUrl: '',
});

const SAVED_MODELS = {
  taskModels: {
    workflow_orchestrator: { providerId: 'anthropic', model: 'claude-sonnet-5' },
    summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
  },
  roleModels: {
    planner: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
    reviewer: { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
  },
};

const seedSavedProjects = (): Readonly<Record<string, string>> => {
  const { currentWorkspaceId: workspaceId, projects } = useAppStore.getState();
  return Object.fromEntries(
    projects
      .filter((project) => project.workspaceId === workspaceId)
      .slice(0, SAVED_PROJECTS)
      .map((project) => [`legacy.projectModels.${project.id}`, JSON.stringify(SAVED_MODELS)]),
  );
};

const seedModelsPage = (): void => {
  const { currentWorkspaceId: workspaceId } = useAppStore.getState();
  if (workspaceId === null) {
    return;
  }
  useAppStore.setState((state) => {
    const current =
      state.workspaceOverrides[workspaceId] ??
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.overrides;
    if (current === undefined) {
      return state;
    }
    return {
      providers: [
        connected({ id: 'anthropic', label: 'Claude', binary: 'claude' }),
        connected({ id: 'codex', label: 'Codex', binary: 'codex' }),
      ],
      refreshProviders: async () => undefined,
      workspaceOverrides: {
        ...state.workspaceOverrides,
        [workspaceId]: {
          ...current,
          defaultProviderId: 'codex',
          providerPool: [
            { id: 'codex', state: 'on' },
            { id: 'anthropic', state: 'off' },
          ],
          roleModels: null,
          taskModels: null,
        },
      },
    };
  });
};

const SavedModelsOverApp = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedFrame({ context: 'session' });
    installSettingsInvokeMocks({ settings: seedSavedProjects() });
    seedModelsPage();
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const id = window.setTimeout(
      () =>
        useAppStore.getState().switchStudio({
          studio: { kind: 'settings', focus: { scope: 'providers' } },
        }),
      OPEN_DELAY_MS,
    );
    return () => window.clearTimeout(id);
  }, [isReady]);

  if (!isReady) {
    return null;
  }
  return <AppFrame view="settings-over-app" isRailCollapsed={false} />;
};

export const U24_RESOLVER_RUNTIME_SCENES: Readonly<Record<string, ComponentType>> = {
  'models-saved-project': SavedModelsOverApp,
  'turn-override-off': OverrideOffNoteScene,
};
