import { useState } from 'react';
import { type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { type ProviderDisplayInfo } from '../../../providers/providers';
import { PROVIDER_ORDER } from '../../../providers/components/ProviderStudio/providerOrder';
import { ProviderRow } from './ProviderRow';

export const ProvidersStep = () => {
  const providers = useAppStore((s) => s.providers);
  const [expandedId, setExpandedId] = useState<ProviderId | null>(null);
  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderDisplayInfo => p !== undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect a provider
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Every agent runs through a provider, so connect at least one.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {ordered.map((info) => (
          <ProviderRow
            key={info.id}
            info={info}
            isExpanded={expandedId === info.id}
            onExpandedChange={({ providerId }) => setExpandedId(providerId)}
          />
        ))}
      </ul>
    </div>
  );
};
