import { Check } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PROVIDER_LABEL_LOWER, type ProviderInfo } from '../../../providers/providers';
import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand';
import { StatusPill } from '../../../providers/components/ProviderLifecycleTile/StatusPill';
import { openProviderModal } from '../../../providers/components/ProviderModalHost';
import type { ProviderLifecyclePhase } from '../../../../store/slices/providers';

const PROVIDER_ORDER: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'cursor', 'gemini'];

export function ProvidersStep() {
  const providers = useAppStore((s) => s.providers);
  const lifecycle = useAppStore((s) => s.providerLifecycle);
  const ordered = PROVIDER_ORDER.map((id) => providers.find((p) => p.id === id)).filter(
    (p): p is ProviderInfo => p !== undefined,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect a provider
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Goodboy runs your agents through these CLIs. Connect at least one to start; add the others
          whenever.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {ordered.map((info) => (
          <ProviderRow key={info.id} info={info} phase={lifecycle[info.id].phase} />
        ))}
      </ul>
    </div>
  );
}

function ProviderRow({ info, phase }: { info: ProviderInfo; phase: ProviderLifecyclePhase }) {
  const Icon = PROVIDER_BRAND[info.id].icon;
  const connected = info.connection === 'connected';
  const action = info.connection === 'missing' ? 'install' : 'login';

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
        <StatusPill phase={phase} connection={info.connection} />
      </div>
      {connected ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
          <Check size={14} aria-hidden /> Connected
        </span>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openProviderModal({ providerId: info.id, action })}
        >
          Connect
        </Button>
      )}
    </li>
  );
}
