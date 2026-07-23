import { useState } from 'react';
import { Divider, ScrollFade } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction, WorkspaceId } from '@goodboy/types';
import { ProviderStudioIcon } from '../brand-icons';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { ProvidersRail } from './ProvidersRail';
import { ProviderDetailPanel } from './ProviderDetailPanel';
import { ProviderConnectPane } from './ProviderConnectPane';
import { DefaultsPanel } from './DefaultsPanel';

const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'cursor', 'codex', 'gemini'];

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
  const [focused, setFocused] = useState<ProviderId | 'defaults'>(initialFocus ?? 'defaults');
  const [connectAction, setConnectAction] = useState<ProviderLifecycleAction | null>(
    initialFocus && initialAction ? initialAction : null,
  );

  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderInfo => p !== undefined,
  );

  const selected = ordered.find((p) => p.id === focused) ?? null;

  const onSelect = (id: ProviderId) => {
    setConnectAction(null);
    setFocused(id);
  };

  return (
    <StudioShell
      icon={ProviderStudioIcon}
      title="Provider Studio"
      workspaceName={workspaceName}
      closeLabel="close provider studio"
      onClose={onClose}
    >
      {() => (
        <>
          <ScrollFade className="w-72 shrink-0" fadeFrom="background">
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
          <Divider orientation="vertical" />
          <div className="min-h-0 flex-1">
            {focused === 'defaults' ? (
              <DefaultsPanel workspaceId={workspaceId} />
            ) : selected && connectAction ? (
              <ProviderConnectPane
                providerId={selected.id as ProviderId}
                action={connectAction}
                onBack={() => setConnectAction(null)}
              />
            ) : (
              <ProviderDetailPanel info={selected} onConnect={setConnectAction} />
            )}
          </div>
        </>
      )}
    </StudioShell>
  );
};
