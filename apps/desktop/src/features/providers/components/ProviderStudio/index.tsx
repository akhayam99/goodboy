import { useEffect } from 'react';
import {
  PROVIDER_IDS,
  type ProviderId,
  type ProviderLifecycleAction,
  type WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isConfirmationStale } from '../../../../store/slices/providers/providerHealth';
import type { ScopeFrame } from '../../../settings/components/SettingsStudio/types';
import { isConnectRunning } from '../ProviderConnect/isConnectRunning';
import { ProviderPage } from './ProviderPage';
import { DefaultsPanel } from './DefaultsPanel';
import { PROVIDER_ORDER } from './providerOrder';
import { orderProviders } from '../../orderProviders';
import { MODELS_SECTION } from './ProviderPage/ModelsGroup/constants';
import { USAGE_SECTION } from './ProviderPage/UsageGroup/usageSectionId';

const ALL_WORKSPACES = 'All workspaces';
const CONFIRMATION_TTL_MS = 60_000;

type Props = {
  readonly workspaceId: WorkspaceId | null;
  readonly initialFocus?: ProviderId | null;
  readonly initialAction?: ProviderLifecycleAction | null;
  readonly initialSection?: string;
  readonly frame: ScopeFrame;
};

export const ProviderSettingsScope = ({
  workspaceId,
  initialFocus,
  initialAction,
  initialSection,
  frame,
}: Props) => {
  const providers = useAppStore((s) => s.providers);
  const workspaceName = useAppStore(
    (s) => s.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? null,
  );
  const scopeLabel = workspaceId === null ? ALL_WORKSPACES : workspaceName;
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const focused: ProviderId | 'defaults' =
    initialFocus ?? (workspaceId === null ? (PROVIDER_ORDER[0] ?? 'defaults') : 'defaults');
  const autoConnect = initialFocus != null && initialAction != null && initialAction !== 'update';
  const autoUpdate = initialFocus != null && initialAction === 'update';

  const ordered = orderProviders({ providers });

  const selected = ordered.find((p) => p.id === focused) ?? null;

  useEffect(() => {
    const connect = useAppStore.getState().providerConnect;
    const isInFlight = Object.values(connect).some((item) =>
      isConnectRunning({ phase: item.phase }),
    );
    if (isInFlight) {
      return;
    }
    const { providerHealth } = useAppStore.getState();
    const nowMs = Date.now();
    const checked = focused === 'defaults' ? PROVIDER_IDS : [focused];
    const isStale = checked.some((id) =>
      isConfirmationStale({ health: providerHealth[id], nowMs, maxAgeMs: CONFIRMATION_TTL_MS }),
    );
    if (!isStale) {
      return;
    }
    void refreshProviders();
  }, [focused, refreshProviders]);

  return frame({
    detail:
      focused === 'defaults' && workspaceId !== null ? (
        <DefaultsPanel
          workspaceId={workspaceId}
          scopeLabel={scopeLabel}
          {...(initialSection !== undefined && { focusSection: initialSection })}
        />
      ) : (
        <ProviderPage
          info={selected}
          autoConnect={autoConnect && selected?.id === initialFocus}
          autoUpdate={autoUpdate && selected?.id === initialFocus}
          workspaceId={workspaceId}
          scopeLabel={scopeLabel}
          focusModels={initialSection === MODELS_SECTION && selected?.id === initialFocus}
          isUsageFocused={initialSection === USAGE_SECTION && selected?.id === initialFocus}
        />
      ),
  });
};
