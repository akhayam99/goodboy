import { useEffect, useState } from 'react';
import { Divider, ScrollFade } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { ProviderStudioIcon } from '../brand-icons';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { ProvidersRail } from './ProvidersRail';
import { ProviderDetailPanel } from './ProviderDetailPanel';
import { ProviderConnectPane } from './ProviderConnectPane';

const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'cursor', 'codex', 'gemini', 'opencode'];

type Props = {
  readonly workspaceName: string;
  readonly initialFocus?: ProviderId | null;
  readonly initialAction?: ProviderLifecycleAction | null;
  readonly onClose: () => void;
};

export const ProviderStudio = ({ workspaceName, initialFocus, initialAction, onClose }: Props) => {
  const providers = useAppStore((s) => s.providers);
  const [focused, setFocused] = useState<ProviderId | null>(initialFocus ?? null);
  const [connectAction, setConnectAction] = useState<ProviderLifecycleAction | null>(
    initialFocus && initialAction ? initialAction : null,
  );

  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderInfo => p !== undefined,
  );

  useEffect(() => {
    if (focused !== null) {
      return;
    }
    const first = ordered.find((p) => p.connection === 'connected')?.id ?? ordered[0]?.id ?? null;
    if (first) {
      setFocused(first);
    }
  }, [focused, ordered]);

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
            <ProvidersRail providers={ordered} focusedId={focused} onSelect={onSelect} />
          </ScrollFade>
          <Divider orientation="vertical" />
          <div className="min-h-0 flex-1">
            {selected && connectAction ? (
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
