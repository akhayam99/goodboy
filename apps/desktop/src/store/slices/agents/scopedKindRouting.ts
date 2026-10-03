import type { AutoContext } from '@goodboy/core';
import type { ResolvedSettings } from '@goodboy/types';
import {
  kindRouting,
  type AgentKind,
  type AgentKindRouting,
} from '../../../features/session/agent-kind';
import { kindAutoContext } from '../../../features/session/kindAutoContext';
import type { AppStore } from '../../store';
import { autoLimitContext } from '../providerLimits/autoLimitContext';

type ScopeParams = {
  readonly state: AppStore;
  readonly settings: Pick<
    ResolvedSettings,
    'roleModels' | 'defaultProviderId' | 'providerPool'
  > | null;
};

type Params = ScopeParams & {
  readonly kind: AgentKind;
};

export const scopedRoutingScope = ({ state, settings }: ScopeParams): AutoContext | null =>
  kindAutoContext({
    defaultProvider: settings?.defaultProviderId ?? null,
    limitContext: autoLimitContext({ state }),
    ...(settings != null && { policy: settings.providerPool }),
  });

export const scopedKindRouting = ({ state, settings, kind }: Params): AgentKindRouting =>
  kindRouting({
    kind,
    roleModels: settings?.roleModels ?? null,
    defaultProvider: settings?.defaultProviderId ?? null,
    limitContext: autoLimitContext({ state }),
    ...(settings != null && { policy: settings.providerPool }),
  });
