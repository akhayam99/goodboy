import { useEffect, useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction, WorkspaceId } from '@goodboy/types';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioRailLayout } from '../../../../shared/components/StudioRailLayout';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { isConnectRunning } from '../ProviderConnect/connectView';
import { ProvidersRail } from './ProvidersRail';
import { ProviderDetailPanel } from './ProviderDetailPanel';
import { DefaultsPanel } from './DefaultsPanel';
import { PROVIDER_ORDER } from './providerOrder';

type Props = {
  readonly workspaceName: string;
  readonly workspaceId: WorkspaceId;
  readonly initialFocus?: ProviderId | null;
  readonly initialAction?: ProviderLifecycleAction | null;
  readonly onClose: () => void;
};

export const ProviderStudio = ({
  workspaceName,
  workspaceId,
  initialFocus,
  initialAction,
  onClose,
}: Props) => {
  const providers = useAppStore((s) => s.providers);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const [focused, setFocused] = useState<ProviderId | 'defaults'>(initialFocus ?? 'defaults');
  const [autoConnect, setAutoConnect] = useState(initialFocus != null && initialAction != null);

  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderInfo => p !== undefined,
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
    setFocused(id);
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.providers}
      tone={CONCEPT_TONE.providers}
      title="Provider studio"
      workspaceName={workspaceName}
      closeLabel="close provider studio"
      onClose={onClose}
    >
      {() => (
        <StudioRailLayout
          railLabel="Providers"
          railWidth="standard"
          rail={
            <ScrollFade className="min-h-0 flex-1" fadeFrom="background">
              <ProvidersRail
                providers={ordered}
                focusedId={focused}
                onSelect={onSelect}
                onSelectDefaults={() => {
                  setAutoConnect(false);
                  setFocused('defaults');
                }}
              />
            </ScrollFade>
          }
          detail={
            focused === 'defaults' ? (
              <DefaultsPanel workspaceId={workspaceId} />
            ) : (
              <ProviderDetailPanel
                info={selected}
                autoConnect={autoConnect && selected?.id === initialFocus}
              />
            )
          }
        />
      )}
    </StudioShell>
  );
};
