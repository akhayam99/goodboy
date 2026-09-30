import type { SessionId } from '@goodboy/types';
import {
  kindRouting,
  type AgentKind,
  type AgentKindRouting,
} from '../../../features/session/agent-kind';
import type { AppStore } from '../../store';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { autoLimitContext } from '../providerLimits/autoLimitContext';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly kind: AgentKind;
};

export const selectKindRouting = ({ state, sessionId, kind }: Params): AgentKindRouting => {
  const settings = selectResolvedSettings({ state, sessionId });
  return kindRouting({
    kind,
    roleModels: settings?.roleModels ?? null,
    defaultProvider: settings?.defaultProviderId ?? null,
    limitContext: autoLimitContext({ state }),
  });
};
