import {
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  parseHiddenModels,
  providersAtLimit,
  type ResolveContext,
  type ResolveLayers,
  type ScopedLayer,
} from '@goodboy/core';
import { PROVIDER_IDS, type ProviderId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { autoRoutableProviders } from '../../../features/providers/autoRoutableProviders';
import { SETTING_HIDDEN_MODELS } from '../../../features/settings/settings';
import type { AppStore } from '../../store';
import { projectById } from '../projects/projectIndex';
import { sessionById } from '../sessions/sessionIndex';

export type ModelState = Pick<
  AppStore,
  | 'providers'
  | 'providerLimits'
  | 'settings'
  | 'cliRequirements'
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

type ScopedParams = {
  readonly state: ModelState;
  readonly workspaceId: WorkspaceId;
};

const scopedProjects = ({ state, workspaceId }: ScopedParams): ReadonlyArray<ScopedLayer> =>
  state.projects.flatMap((project): ScopedLayer[] => {
    if (project.workspaceId !== workspaceId || project.disconnectedAt !== undefined) {
      return [];
    }
    return [{ kind: 'project', name: project.name, layer: project.overrides }];
  });

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
  const isWorkspacePage = session === undefined && scopeWorkspaceId !== null;
  const layers: ResolveLayers = {
    workspace:
      scopeWorkspaceId === null ? null : (state.workspaceOverrides?.[scopeWorkspaceId] ?? null),
    project: project?.overrides ?? null,
    session: session === undefined ? null : (state.sessionOverrides?.[session.id] ?? null),
    ...(isWorkspacePage && { scoped: scopedProjects({ state, workspaceId: scopeWorkspaceId }) }),
  };
  const providers = state.providers ?? [];
  const cliVersions: Partial<Record<ProviderId, string | null>> = Object.fromEntries(
    providers.flatMap((provider) =>
      provider.version == null ? [] : [[provider.id, provider.version]],
    ),
  );
  const hiddenRaw = state.settings?.[SETTING_HIDDEN_MODELS] ?? null;
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
      hidden: parseHiddenModels(hiddenRaw),
      cliVersions,
      learned: state.cliRequirements ?? [],
    },
  };
};
