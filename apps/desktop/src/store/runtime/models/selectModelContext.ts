import {
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  providersAtLimit,
  type ResolveContext,
  type ResolveLayers,
} from '@goodboy/core/providers';
import { PROVIDER_IDS, type ProviderId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { autoRoutableProviders } from '../../../features/providers/autoRoutableProviders';
import type { AppStore } from '../../store';
import { projectById } from '../../slices/projects/projectIndex';
import { selectBlockedModels } from '../../slices/providers/selectBlockedModels';
import { sessionById } from '../../slices/sessions/sessionIndex';

export type ModelState = Pick<
  AppStore,
  | 'providers'
  | 'providerLimits'
  | 'settings'
  | 'cliRequirements'
  | 'unavailableModels'
  | 'authResults'
  | 'workspaceOverrides'
  | 'sessionOverrides'
  | 'projects'
  | 'sessions'
  | 'sessionActiveProject'
>;

export type ModelScope = Readonly<{
  workspaceId: WorkspaceId | null;
  layers: ResolveLayers;
  context: ResolveContext;
}>;

type Params = {
  readonly state: ModelState;
  readonly workspaceId?: WorkspaceId | null;
  readonly sessionId?: SessionId | null;
  readonly nowMs?: number;
};

export const selectModelContext = ({
  state,
  workspaceId = null,
  sessionId = null,
  nowMs = Date.now(),
}: Params): ModelScope => {
  const session = sessionId === null ? undefined : sessionById(state.sessions, sessionId);
  const scopeWorkspaceId = session?.workspaceId ?? workspaceId;
  const activeProjectId = session === undefined ? null : state.sessionActiveProject?.[session.id];
  const project = activeProjectId == null ? null : projectById(state.projects, activeProjectId);
  const layers: ResolveLayers = {
    workspace:
      scopeWorkspaceId === null ? null : (state.workspaceOverrides?.[scopeWorkspaceId] ?? null),
    project: project?.overrides ?? null,
    session: session === undefined ? null : (state.sessionOverrides?.[session.id] ?? null),
  };
  const providers = state.providers ?? [];
  const cliVersions: Partial<Record<ProviderId, string | null>> = Object.fromEntries(
    providers.flatMap((provider) =>
      provider.version == null ? [] : [[provider.id, provider.version]],
    ),
  );
  return {
    workspaceId: scopeWorkspaceId,
    layers,
    context: {
      defaultProvider:
        PROVIDER_IDS.find((id) => id === session?.providerOverride) ??
        session?.providerPreference.defaultProvider ??
        DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
      connected: autoRoutableProviders({ providers }),
      atLimit: providersAtLimit({ limits: state.providerLimits ?? {}, nowMs }),
      hidden: selectBlockedModels({ state, nowMs }),
      cliVersions,
      learned: state.cliRequirements ?? [],
    },
  };
};
