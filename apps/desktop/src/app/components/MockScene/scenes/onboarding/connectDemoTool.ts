import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { InstantTool } from '../../../../../features/onboarding/OnboardingWizard/instantToolConnectContext';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly tool: InstantTool;
};

type BindingParams = Params & {
  readonly at: IsoDateTime;
};

const bindingOf = ({ workspaceId, tool, at }: BindingParams): IntegrationBinding => {
  const base = {
    id: brandId<IntegrationBindingId>({ value: `mock-binding-${workspaceId}-${tool}` }),
    workspaceId,
    projectId: null,
    credentialId: brandId<IntegrationCredentialId>({ value: `mock-credential-${tool}` }),
    createdAt: at,
    updatedAt: at,
  };
  switch (tool) {
    case 'linear':
      return {
        ...base,
        provider: 'linear',
        config: {
          workspaceUrlKey: 'harborline',
          viewerUserId: 'mock-linear-dana',
          viewerName: 'Dana R.',
        },
      };
    case 'jira':
      return {
        ...base,
        provider: 'jira',
        config: {
          siteUrl: 'https://harborline.atlassian.net',
          email: 'dana@harborline.dev',
          projectKey: 'HBL',
          displayName: 'Dana R.',
        },
      };
    case 'gitlab':
      return {
        ...base,
        provider: 'gitlab',
        config: { userName: 'dana', userId: 'mock-gitlab-dana', host: 'gitlab.com' },
      };
    case 'bitbucket':
      return {
        ...base,
        provider: 'bitbucket',
        config: {
          workspaceSlug: 'harborline',
          email: 'dana@harborline.dev',
          displayName: 'Dana R.',
        },
      };
    default: {
      const unreachable: never = tool;
      return unreachable;
    }
  }
};

export const connectDemoTool = ({ workspaceId, tool }: Params): void => {
  const binding = bindingOf({ workspaceId, tool, at: nowIso({}) });
  useAppStore.setState((state) => {
    const current = state.workspaceIntegrations[workspaceId] ?? [];
    if (current.some((entry) => entry.provider === tool)) {
      return {};
    }
    return {
      workspaceIntegrations: {
        ...state.workspaceIntegrations,
        [workspaceId]: [...current, binding],
      },
    };
  });
};
