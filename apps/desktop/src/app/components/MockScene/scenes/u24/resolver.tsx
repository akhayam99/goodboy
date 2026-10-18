import { useEffect, useState, type ComponentType } from 'react';
import type { AgentRole, ProviderId, ProviderPolicy, RoleModelPreference } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { installSettingsInvokeMocks } from '../audit/installSettingsInvokeMocks';

const OPEN_DELAY_MS = 30;

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
  version: '2.1.296',
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
  readonly openRole?: string;
  readonly scrollTo?: string;
};

const FOCUS_POLL_MS = 100;

const FOCUS_POLL_LIMIT = 80;

const ROW_SCROLL_DELAY_MS = 150;

type FocusParams = {
  readonly openRole: string | undefined;
  readonly scrollTo: string | undefined;
};

type ScrollParams = {
  readonly node: Element;
};

const scrollToStart = ({ node }: ScrollParams): void => {
  if (typeof node.scrollIntoView === 'function') {
    node.scrollIntoView({ block: 'start' });
  }
};

const applyFocus = ({ openRole, scrollTo }: FocusParams): boolean => {
  if (openRole !== undefined) {
    const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) =>
        button.textContent?.startsWith(openRole) === true && button.hasAttribute('aria-expanded'),
    );
    if (trigger === undefined) {
      return false;
    }
    trigger.click();
    window.setTimeout(() => scrollToStart({ node: trigger }), ROW_SCROLL_DELAY_MS);
    return true;
  }
  const section = document.querySelector(`section[aria-label="${scrollTo ?? ''}"]`);
  if (section === null) {
    return false;
  }
  scrollToStart({ node: section });
  return true;
};

const ModelsOverApp = ({ policy, openRole, scrollTo }: Props) => {
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

  useEffect(() => {
    if (!isReady || (openRole === undefined && scrollTo === undefined)) {
      return;
    }
    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      if (applyFocus({ openRole, scrollTo }) || attempts >= FOCUS_POLL_LIMIT) {
        window.clearInterval(id);
      }
    }, FOCUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [isReady, openRole, scrollTo]);

  if (!isReady) {
    return null;
  }
  return <AppFrame view="settings-over-app" isRailCollapsed={false} />;
};

export const U24_RESOLVER_SCENES: Readonly<Record<string, ComponentType>> = {
  'models-codex-only': () => <ModelsOverApp policy={CODEX_ONLY} />,
  'models-anthropic-on': () => <ModelsOverApp policy={ANTHROPIC_ON} />,
  'models-anthropic-sized': () => <ModelsOverApp policy={ANTHROPIC_ON} openRole="Implementer" />,
  'models-anthropic-tasks': () => (
    <ModelsOverApp policy={ANTHROPIC_ON} scrollTo="Background tasks" />
  ),
};
