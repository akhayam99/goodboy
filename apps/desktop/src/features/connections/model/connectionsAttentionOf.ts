import { integrationLabel } from '../../../shared/utils/integrationLabel';
import { selectToolKeyCheck } from '../../../store/slices/integrations/selectToolKeyCheck';
import type { AppStore } from '../../../store/store';
import { connectedToolsOf } from '../../integrations/connectedToolsOf';
import { TOOL_ORDER } from '../../integrations/toolOrder';
import { orderProviders } from '../../providers/orderProviders';
import { connectionStateOf } from './connectionStateOf';
import { workspaceBindingsOf } from './workspaceBindingsOf';

type Params = {
  readonly state: Pick<
    AppStore,
    | 'providers'
    | 'cliRequirements'
    | 'providerLimits'
    | 'providerHealth'
    | 'currentWorkspaceId'
    | 'workspaceIntegrations'
    | 'githubWorkspaceStatus'
    | 'githubStatus'
    | 'integrationKeyChecks'
  >;
  readonly nowMs: number;
};

const NO_PROVIDER = 'No provider connected';

const providerReasons = ({ state, nowMs }: Params): ReadonlyArray<string> =>
  orderProviders({ providers: state.providers }).flatMap((provider) => {
    const connection = connectionStateOf({
      subject: { kind: 'provider', provider, state, nowMs },
    });
    return connection.tone === null || connection.setupVerb !== null
      ? []
      : [`${provider.label}: ${connection.word}`];
  });

const toolReasons = ({ state }: Params): ReadonlyArray<string> => {
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null) {
    return [];
  }
  const connected = connectedToolsOf({
    integrations: workspaceBindingsOf({
      integrations: state.workspaceIntegrations[workspaceId] ?? [],
    }),
    githubStatuses: [state.githubWorkspaceStatus[workspaceId], state.githubStatus],
  });
  return TOOL_ORDER.flatMap((tool) => {
    const connection = connectionStateOf({
      subject: {
        kind: 'tool',
        isConnected: connected[tool],
        hasKey: tool !== 'github',
        keyCheck: selectToolKeyCheck({ state, workspaceId, tool }),
      },
    });
    return connection.tone === null
      ? []
      : [`${integrationLabel({ provider: tool })}: ${connection.word}`];
  });
};

const hasNoProvider = ({ state }: Pick<Params, 'state'>): boolean =>
  state.providers.length > 0 &&
  state.providers.every((provider) => provider.connection !== 'unknown') &&
  state.providers.every((provider) => provider.connection !== 'connected');

export const connectionsAttentionOf = ({ state, nowMs }: Params): string | null => {
  const reasons = [...providerReasons({ state, nowMs }), ...toolReasons({ state, nowMs })];
  const [only] = reasons;
  if (reasons.length > 1) {
    return `${reasons.length} connections need attention`;
  }
  if (only !== undefined) {
    return only;
  }
  return hasNoProvider({ state }) ? NO_PROVIDER : null;
};
