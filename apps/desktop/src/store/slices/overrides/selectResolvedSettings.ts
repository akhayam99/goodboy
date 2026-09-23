import { resolveSettings } from '@goodboy/core';
import type {
  ProjectId,
  ProviderId,
  ResolvedSettings,
  Session,
  SessionId,
  VerbosityLevel,
  WorkspaceId,
} from '@goodboy/types';
import { DEFAULT_BRANCH_PREFIX } from '../../../features/settings/settings';
import type { AppStore } from '../../store';

export type SessionSettings = ResolvedSettings & {
  readonly defaultProviderOverride: ProviderId | null;
  readonly defaultVerbosityOverride: VerbosityLevel | null;
};

type ScopeParams = {
  readonly state: AppStore;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly sessionId: SessionId | null;
  readonly defaultProviderId: ProviderId;
};

export const resolveScopedSettings = ({
  state,
  workspaceId,
  projectId,
  sessionId,
  defaultProviderId,
}: ScopeParams): SessionSettings => {
  const workspaceOverride = state.workspaceOverrides?.[workspaceId] ?? null;
  const projectOverride =
    projectId === null
      ? null
      : (state.projects?.find((project) => project.id === projectId)?.overrides ?? null);
  const sessionOverride = sessionId === null ? null : (state.sessionOverrides?.[sessionId] ?? null);
  const resolved = resolveSettings({
    global: {
      defaultProviderId,
      defaultWorkflowId: null,
      defaultBranchPrefix: DEFAULT_BRANCH_PREFIX,
      parallelEnabled: false,
      defaultVerbosity: 'normal',
    },
    workspaceOverride,
    projectOverride,
    sessionOverride,
  });
  return {
    ...resolved,
    defaultProviderOverride:
      sessionOverride?.defaultProviderId ??
      projectOverride?.defaultProviderId ??
      workspaceOverride?.defaultProviderId ??
      null,
    defaultVerbosityOverride:
      sessionOverride?.defaultVerbosity ??
      projectOverride?.defaultVerbosity ??
      workspaceOverride?.defaultVerbosity ??
      null,
  };
};

type SessionParams = {
  readonly state: AppStore;
  readonly session: Session;
};

export const resolveSessionSettings = ({ state, session }: SessionParams): SessionSettings =>
  resolveScopedSettings({
    state,
    workspaceId: session.workspaceId,
    projectId: state.sessionActiveProject?.[session.id] ?? null,
    sessionId: session.id,
    defaultProviderId: session.providerPreference.defaultProvider,
  });

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId | null;
};

export const selectResolvedSettings = ({ state, sessionId }: Params): SessionSettings | null => {
  if (sessionId === null) {
    return null;
  }
  const session = state.sessions?.find((entry) => entry.id === sessionId);
  if (session === undefined) {
    return null;
  }
  return resolveSessionSettings({ state, session });
};
