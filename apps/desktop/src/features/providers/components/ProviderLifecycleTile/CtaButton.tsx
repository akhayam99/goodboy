import { cn } from '@goodboy/ui';
import type { ProviderLifecycleAction } from '@goodboy/types';
import type { ProviderLifecyclePhase } from '../../../../store/slices/providers';
import type { ProviderConnectionState } from '../../../../features/providers/providers';

// CTA descriptor: derived once per render so the tile can ask "what should
// the primary button do right now" without duplicating the phase-to-action
// mapping. Returning null means the tile renders its own composite controls
// (e.g. the disconnect confirm chip).
export interface CtaIntent {
  readonly label: string;
  readonly action: ProviderLifecycleAction | 'cancel';
  readonly variant: 'primary' | 'secondary' | 'danger';
}

export function intentForState(
  phase: ProviderLifecyclePhase,
  connection: ProviderConnectionState,
): CtaIntent | null {
  if (phase === 'installing' || phase === 'connecting' || phase === 'disconnecting') {
    return { label: 'Cancel', action: 'cancel', variant: 'secondary' };
  }
  if (phase === 'installed') {
    return { label: 'Connect', action: 'login', variant: 'primary' };
  }
  if (phase === 'cancelled' || phase === 'error') {
    if (connection === 'connected') {
      return { label: 'Disconnect', action: 'logout', variant: 'secondary' };
    }
    if (connection === 'installed_disconnected') {
      return { label: 'Connect', action: 'login', variant: 'primary' };
    }
    return { label: 'Retry install', action: 'install', variant: 'primary' };
  }
  // idle / connected / fresh, fall through to connection-driven CTA.
  if (connection === 'connected') {
    return null; // tile renders disconnect-with-confirm composite
  }
  if (connection === 'installed_disconnected') {
    return { label: 'Connect', action: 'login', variant: 'primary' };
  }
  if (connection === 'missing') {
    return { label: 'Install', action: 'install', variant: 'primary' };
  }
  return null;
}

interface Props {
  readonly intent: CtaIntent;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

const VARIANT_CLASS: Record<CtaIntent['variant'], string> = {
  primary: 'border-primary/30 text-primary hover:bg-primary/10',
  secondary: 'border-border-soft text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'border-danger/30 text-danger hover:bg-danger/10',
};

export function CtaButton({ intent, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'block w-full rounded-md border py-1.5 text-center text-xs transition-colors disabled:opacity-50',
        VARIANT_CLASS[intent.variant],
      )}
    >
      {intent.label}
    </button>
  );
}
