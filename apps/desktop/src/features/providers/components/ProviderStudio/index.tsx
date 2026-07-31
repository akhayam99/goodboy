import { useEffect, useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction, WorkspaceId } from '@goodboy/types';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import { StudioRailLayout } from '../../../../shared/components/StudioRailLayout';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { ProvidersRail } from './ProvidersRail';
import { ProviderDetailPanel } from './ProviderDetailPanel';
import { ProviderConnectPane } from './ProviderConnectPane';
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
  const [connectAction, setConnectAction] = useState<ProviderLifecycleAction | null>(
    initialFocus && initialAction ? initialAction : null,
  );

  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderInfo => p !== undefined,
  );

  const selected = ordered.find((p) => p.id === focused) ?? null;

  useEffect(() => {
    const lifecycle = useAppStore.getState().providerLifecycle;
    const isInFlight = Object.values(lifecycle).some(
      (item) =>
        item.phase === 'installing' ||
        item.phase === 'connecting' ||
        item.phase === 'disconnecting',
    );
    if (isInFlight) {
      return;
    }
    void refreshProviders();
  }, [focused, refreshProviders]);

  const onSelect = (id: ProviderId) => {
    setConnectAction(null);
    setFocused(id);
  };

  return (
    <StudioShell
      icon={SECTION_ICONS.providers}
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
                  setConnectAction(null);
                  setFocused('defaults');
                }}
              />
            </ScrollFade>
          }
          detail={
            focused === 'defaults' ? (
              <DefaultsPanel workspaceId={workspaceId} />
            ) : selected && connectAction ? (
              <ProviderConnectPane
                providerId={selected.id as ProviderId}
                action={connectAction}
                onBack={() => setConnectAction(null)}
              />
            ) : (
              <ProviderDetailPanel info={selected} onConnect={setConnectAction} />
            )
          }
        />
      )}
    </StudioShell>
  );
};
