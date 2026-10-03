import type { ResolvedSettings } from '@goodboy/types';
import {
  kindRouting,
  type AgentKind,
  type AgentKindRouting,
} from '../../../features/session/agent-kind';
import type { AppStore } from '../../store';
import { autoLimitContext } from '../providerLimits/autoLimitContext';

type Params = {
  readonly state: AppStore;
  readonly settings: Pick<
    ResolvedSettings,
    'roleModels' | 'defaultProviderId' | 'providerPool'
  > | null;
  readonly kind: AgentKind;
};

export const scopedKindRouting = ({ state, settings, kind }: Params): AgentKindRouting =>
  kindRouting({
    kind,
    roleModels: settings?.roleModels ?? null,
    defaultProvider: settings?.defaultProviderId ?? null,
    limitContext: autoLimitContext({ state }),
    ...(settings != null && { policy: settings.providerPool }),
  });
