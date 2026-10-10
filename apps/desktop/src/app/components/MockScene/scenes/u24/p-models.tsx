import { useEffect, useState, type ComponentType } from 'react';
import type {
  AgentRole,
  OverrideSettings,
  Project,
  ProjectId,
  ProviderId,
  RoleModelPreference,
  WorkspaceId,
} from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { installSettingsInvokeMocks } from '../audit/installSettingsInvokeMocks';

const OPEN_DELAY_MS = 30;

const clock = sceneClock({ anchor: '2026-10-09T09:00:00.000Z' });

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

const OPUS_PIN: RoleModelPreference = {
  providerId: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
};

const PINNED_ROLES: ReadonlyArray<AgentRole> = [
  'planner',
  'implementer',
  'reviewer',
  'investigator',
  'tester',
  'resolver',
  'docs',
];

const PROJECT_PINS: Pick<OverrideSettings, 'taskModels' | 'roleModels'> = {
  taskModels: {
    workflow_orchestrator: { providerId: 'anthropic', model: 'claude-sonnet-5' },
    summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
  },
  roleModels: Object.fromEntries(
    ['planner', 'implementer', 'reviewer', 'tester', 'resolver', 'scribe'].map((role) => [
      role,
      { providerId: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
    ]),
  ),
};

type ProjectParams = {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly overrides: OverrideSettings;
};

const project = ({ id, workspaceId, name, overrides }: ProjectParams): Project => ({
  id: id as ProjectId,
  workspaceId,
  name,
  rootPath: `/mock/harborline/${name}`,
  kind: 'repo',
  overrides,
  createdAt: clock.iso({ at: '2026-09-27T09:00:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-27T09:00:00.000Z' }),
});

const PAYMENTS_ID = 'mock-models-payments-api';

const SAVED_KEY = `legacy.projectModels.${PAYMENTS_ID}`;

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
    const empty: OverrideSettings = {
      ...current,
      defaultProviderId: null,
      taskModels: null,
      roleModels: null,
      providerPool: null,
    };
    return {
      providers: [
        connected({ id: 'anthropic', label: 'Claude', binary: 'claude' }),
        connected({ id: 'codex', label: 'Codex', binary: 'codex' }),
      ],
      refreshProviders: async () => undefined,
      projects: [
        project({
          id: PAYMENTS_ID,
          workspaceId,
          name: 'payments-api',
          overrides: empty,
        }),
        project({
          id: 'mock-models-ledger-core',
          workspaceId,
          name: 'ledger-core',
          overrides: empty,
        }),
      ],
      workspaceOverrides: {
        ...state.workspaceOverrides,
        [workspaceId]: {
          ...current,
          defaultProviderId: 'codex',
          providerPool: [
            { id: 'codex', state: 'on' },
            { id: 'anthropic', state: 'off' },
          ],
          roleModels: Object.fromEntries(PINNED_ROLES.map((role) => [role, OPUS_PIN])),
          taskModels: {
            workflow_orchestrator: {
              providerId: 'anthropic',
              model: 'claude-sonnet-5-5',
              effort: 'high',
            },
          },
        },
      },
    };
  });
};

type Props = {
  readonly hasSavedModels: boolean;
};

const ModelsOverApp = ({ hasSavedModels }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSettingsInvokeMocks({
      settings: hasSavedModels ? { [SAVED_KEY]: JSON.stringify(PROJECT_PINS) } : {},
    });
    seedFrame({ context: 'session' });
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

export const U24_P_MODELS_SCENES: Readonly<Record<string, ComponentType>> = {
  modelswilluse: () => <ModelsOverApp hasSavedModels />,
  'modelswilluse-cleared': () => <ModelsOverApp hasSavedModels={false} />,
};
