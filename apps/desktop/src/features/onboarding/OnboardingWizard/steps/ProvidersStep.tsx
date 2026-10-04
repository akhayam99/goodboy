import { useState } from 'react';
import { isApiProvider } from '@goodboy/core';
import { Notice } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { type ProviderDisplayInfo } from '../../../providers/providers';
import { PROVIDER_ORDER } from '../../../providers/components/ProviderStudio/providerOrder';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { ProviderCard } from './ProviderCard';
import { StepHeading } from './StepHeading';

export const ProvidersStep = () => {
  const providers = useAppStore((s) => s.providers);
  const [expandedId, setExpandedId] = useState<ProviderId | null>(null);
  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderDisplayInfo => p !== undefined,
  );
  const cliProviders = ordered.filter((info) => !isApiProvider({ id: info.id }));
  const keyProviders = ordered.filter((info) => isApiProvider({ id: info.id }));
  const ready = ordered.find((info) => info.connection === 'connected') ?? null;
  const hasOpenKeyProvider = keyProviders.some(
    (info) => info.connection === 'connected' || info.id === expandedId,
  );
  const renderCard = (info: ProviderDisplayInfo) => (
    <ProviderCard
      key={info.id}
      info={info}
      isExpanded={expandedId === info.id}
      onExpandedChange={({ providerId }) => setExpandedId(providerId)}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <StepHeading title="Which AI do you want to use?" line="Pick the one you already pay for." />
      {ready !== null && (
        <Notice
          tone="success"
          placement="inline"
          role="status"
          title={`${PROVIDER_LABEL[ready.id]} is ready on this Mac.`}
          body="Continue now, or add another one."
        />
      )}
      <ul className="flex flex-col gap-2">{cliProviders.map(renderCard)}</ul>
      {keyProviders.length > 0 && (
        <details open={hasOpenKeyProvider} className="group flex flex-col gap-2">
          <summary className="cursor-pointer select-none text-label text-muted-foreground hover:text-foreground">
            More providers with an API key
          </summary>
          <ul className="mt-2 flex flex-col gap-2">{keyProviders.map(renderCard)}</ul>
        </details>
      )}
    </div>
  );
};
