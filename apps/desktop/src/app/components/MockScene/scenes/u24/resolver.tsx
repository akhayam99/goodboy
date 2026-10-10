import { useEffect, useState, type ComponentType } from 'react';
import type {
  AgentRole,
  OverrideSettings,
  Project,
  ProviderId,
  ProviderPolicy,
  RoleModelPreference,
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

const SONNET_PIN: RoleModelPreference = {
  providerId: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
};

const PINNED_ROLES: ReadonlyArray<AgentRole> = ['planner', 'reviewer', 'investigator', 'tester'];

const CODEX_ONLY: ProviderPolicy = [
  { id: 'codex', state: 'on' },
  { id: 'anthropic', state: 'off' },
];

const ANTHROPIC_ON: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'codex', state: 'on' },
];

type ProjectParams = {
  readonly base: Project;
  readonly overrides: OverrideSettings;
};

const paymentsApi = ({ base, overrides }: ProjectParams): Project => ({
  ...base,
  name: 'payments-api',
  rootPath: '/mock/harborline/payments-api',
  overrides,
  createdAt: clock.iso({ at: '2026-09-27T09:00:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-27T09:00:00.000Z' }),
});

type SeedParams = {
  readonly policy: ProviderPolicy;
};

const seedModelsPage = ({ policy }: SeedParams): void => {
  const { currentWorkspaceId: workspaceId } = useAppStore.getState();
  if (workspaceId === null) {
    return;
  }
  useAppStore.setState((state) => {
    const current =
      state.workspaceOverrides[workspaceId] ??
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.overrides;
    const [base] = state.projects.filter((project) => project.workspaceId === workspaceId);
    if (current === undefined || base === undefined) {
      return state;
    }
    return {
      providers: [
        connected({ id: 'anthropic', label: 'Claude', binary: 'claude' }),
        connected({ id: 'codex', label: 'Codex', binary: 'codex' }),
      ],
      refreshProviders: async () => undefined,
      projects: [
        paymentsApi({
          base,
          overrides: {
            ...current,
            defaultProviderId: null,
            providerPool: null,
            roleModels: null,
            taskModels: {
              workflow_orchestrator: { providerId: 'anthropic', model: 'claude-sonnet-5' },
            },
          },
        }),
      ],
      workspaceOverrides: {
        ...state.workspaceOverrides,
        [workspaceId]: {
          ...current,
          defaultProviderId: policy[0]?.id ?? null,
          providerPool: policy,
          roleModels: {
            ...Object.fromEntries(PINNED_ROLES.map((role) => [role, OPUS_PIN])),
            resolver: SONNET_PIN,
          },
          taskModels: {
            summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
          },
        },
      },
    };
  });
};

type Props = {
  readonly policy: ProviderPolicy;
};

const ModelsOverApp = ({ policy }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSettingsInvokeMocks();
    seedFrame({ context: 'session' });
    seedModelsPage({ policy });
    setIsReady(true);
  }, [policy]);

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

export const U24_RESOLVER_SCENES: Readonly<Record<string, ComponentType>> = {
  'models-codex-only': () => <ModelsOverApp policy={CODEX_ONLY} />,
  'models-anthropic-on': () => <ModelsOverApp policy={ANTHROPIC_ON} />,
};
