import { useEffect, useState } from 'react';
import type { ProviderId, ProviderLifecycleAction, WorkspaceId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import type { ScopeFrame } from '../../../settings/components/SettingsStudio/types';
import { isConnectRunning } from '../ProviderConnect/isConnectRunning';
import { ProvidersRail } from './ProvidersRail';
import { ProviderDetailPanel } from './ProviderDetailPanel';
import { DefaultsPanel } from './DefaultsPanel';
import { PROVIDER_ORDER } from './providerOrder';
import { MODELS_SECTION } from './ModelVisibilitySection/constants';

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
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const landing: ProviderId | 'defaults' =
    initialFocus ?? (workspaceId === null ? (PROVIDER_ORDER[0] ?? 'defaults') : 'defaults');
  const [focused, setFocused] = useState<ProviderId | 'defaults'>(landing);
  const wantsConnect = initialFocus != null && initialAction != null && initialAction !== 'update';
  const wantsUpdate = initialFocus != null && initialAction === 'update';
  const [autoConnect, setAutoConnect] = useState(wantsConnect);
  const [autoUpdate, setAutoUpdate] = useState(wantsUpdate);

  useEffect(() => {
    setFocused(landing);
    setAutoConnect(wantsConnect);
    setAutoUpdate(wantsUpdate);
  }, [initialAction, landing, wantsConnect, wantsUpdate]);

  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderDisplayInfo => p !== undefined,
  );

  const selected = ordered.find((p) => p.id === focused) ?? null;

  useEffect(() => {
    const connect = useAppStore.getState().providerConnect;
    const isInFlight = Object.values(connect).some((item) =>
      isConnectRunning({ phase: item.phase }),
    );
    if (isInFlight) {
      return;
    }
    void refreshProviders();
  }, [focused, refreshProviders]);

  const onSelect = (id: ProviderId) => {
    setAutoConnect(false);
    setAutoUpdate(false);
    setFocused(id);
  };

  return frame({
    nested: (
      <ProvidersRail
        providers={ordered}
        focusedId={focused}
        onSelect={onSelect}
        onSelectDefaults={
          workspaceId === null
            ? undefined
            : () => {
                setAutoConnect(false);
                setAutoUpdate(false);
                setFocused('defaults');
              }
        }
      />
    ),
    detail:
      focused === 'defaults' && workspaceId !== null ? (
        <DefaultsPanel workspaceId={workspaceId} />
      ) : (
        <ProviderDetailPanel
          info={selected}
          autoConnect={autoConnect && selected?.id === initialFocus}
          autoUpdate={autoUpdate && selected?.id === initialFocus}
          focusModels={initialSection === MODELS_SECTION && selected?.id === initialFocus}
        />
      ),
  });
};
