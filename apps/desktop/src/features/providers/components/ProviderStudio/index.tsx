import { useEffect, useState } from 'react';
import { Divider } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { ProviderStudioIcon } from '../brand-icons';
import type { ProviderInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { ProvidersRail } from './ProvidersRail';
import { ProviderDetailPanel } from './ProviderDetailPanel';

const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'cursor', 'codex', 'gemini'];

type Props = {
  readonly workspaceName: string;
  readonly initialFocus?: ProviderId | null;
  readonly onClose: () => void;
};

export function ProviderStudio({ workspaceName, initialFocus, onClose }: Props) {
  const providers = useAppStore((s) => s.providers);
  const [focused, setFocused] = useState<ProviderId | null>(initialFocus ?? null);

  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderInfo => p !== undefined,
  );

  useEffect(() => {
    if (focused !== null) return;
    const first = ordered.find((p) => p.connection === 'connected')?.id ?? ordered[0]?.id ?? null;
    if (first) setFocused(first);
  }, [focused, ordered]);

  const selected = ordered.find((p) => p.id === focused) ?? null;

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
          <div className="w-72 shrink-0 overflow-y-auto">
            <ProvidersRail providers={ordered} focusedId={focused} onSelect={setFocused} />
          </div>
          <Divider orientation="vertical" />
          <div className="min-h-0 flex-1">
            <ProviderDetailPanel info={selected} />
          </div>
        </>
      )}
    </StudioShell>
  );
}
