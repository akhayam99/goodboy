import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { PROVIDER_CONNECT_CAPABILITIES, isApiProvider, type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PROVIDER_LABEL_LOWER, type ProviderInfo } from '../../../providers/providers';
import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand';
import { StatusPill } from '../../../providers/components/ProviderLifecycleTile/StatusPill';
import { ProviderConnectModal } from '../../../providers/components/ProviderConnectModal';

export const PROVIDER_ORDER = [
  'anthropic',
  'codex',
  'cursor',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
] satisfies ReadonlyArray<ProviderId>;

type Expect<T extends true> = T;
type ProviderOrderIsTotal =
  Exclude<ProviderId, (typeof PROVIDER_ORDER)[number]> extends never ? true : false;
type _ProviderOrderTotalCheck = Expect<ProviderOrderIsTotal>;

export const ProvidersStep = () => {
  const providers = useAppStore((s) => s.providers);
  const [connectTarget, setConnectTarget] = useState<ProviderId | null>(null);
  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderInfo => p !== undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect a provider
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Every agent runs through a provider CLI, so connect at least one.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {ordered.map((info) => (
          <ProviderRow key={info.id} info={info} onConnect={setConnectTarget} />
        ))}
      </ul>

      <ProviderConnectModal providerId={connectTarget} onClose={() => setConnectTarget(null)} />
    </div>
  );
};

function ProviderRow({
  info,
  onConnect,
}: {
  info: ProviderInfo;
  onConnect: (providerId: ProviderId) => void;
}) {
  const Icon = PROVIDER_BRAND[info.id].icon;
  const connected = info.connection === 'connected';
  const isApi = isApiProvider({ id: info.id });
  const isManual = PROVIDER_CONNECT_CAPABILITIES[info.id].tier === 'manual';

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border-soft/50 bg-subtle/20 px-3.5 py-2.5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/30"
        style={{ color: brandColor(info.id) }}
      >
        <Icon size={18} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium capitalize text-foreground">
          {PROVIDER_LABEL_LOWER[info.id]}
        </span>
        <StatusPill connection={info.connection} />
      </div>
      {connected ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
          <Check size={14} aria-hidden /> Connected
        </span>
      ) : isApi ? (
        <span className="text-xs text-muted-foreground">Set up later</span>
      ) : isManual ? (
        <Button size="sm" variant="ghost" onClick={() => onConnect(info.id)}>
          Set up manually
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => onConnect(info.id)}>
          Connect
        </Button>
      )}
    </li>
  );
}
