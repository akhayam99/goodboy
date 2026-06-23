import { cn } from '@goodboy/ui';
import type { ProviderLifecyclePhase } from '../../../../store/slices/providers';
import type { ProviderConnectionState } from '../../../../features/providers/providers';

type Props = {
  readonly phase: ProviderLifecyclePhase;
  readonly connection: ProviderConnectionState;
};

type PillSpec = {
  readonly label: string;
  readonly dotClass: string;
  readonly labelClass: string;
};

function specFor(phase: ProviderLifecyclePhase, connection: ProviderConnectionState): PillSpec {
  switch (phase) {
    case 'installing':
      return {
        label: 'Installing',
        dotClass: 'bg-primary motion-safe:animate-pulse',
        labelClass: 'text-primary',
      };
    case 'connecting':
      return {
        label: 'Signing in',
        dotClass: 'bg-primary motion-safe:animate-pulse',
        labelClass: 'text-primary',
      };
    case 'disconnecting':
      return {
        label: 'Signing out',
        dotClass: 'bg-muted-foreground motion-safe:animate-pulse',
        labelClass: 'text-muted-foreground',
      };
    case 'installed':
      return { label: 'Ready to connect', dotClass: 'bg-warning', labelClass: 'text-warning' };
    case 'cancelled':
      return {
        label: 'Cancelled',
        dotClass: 'bg-muted-foreground/60',
        labelClass: 'text-muted-foreground',
      };
    case 'error':
      return { label: 'Error', dotClass: 'bg-danger', labelClass: 'text-danger' };
    case 'connected':
      return { label: 'Connected', dotClass: 'bg-primary', labelClass: 'text-primary' };
    case 'idle':
    default:
      return connectionSpec(connection);
  }
}

function connectionSpec(connection: ProviderConnectionState): PillSpec {
  switch (connection) {
    case 'connected':
      return { label: 'Connected', dotClass: 'bg-primary', labelClass: 'text-primary' };
    case 'installed_disconnected':
      return { label: 'Not signed in', dotClass: 'bg-warning', labelClass: 'text-warning' };
    case 'missing':
      return {
        label: 'Not installed',
        dotClass: 'bg-muted-foreground/40',
        labelClass: 'text-muted-foreground',
      };
    case 'error':
      return { label: 'Error', dotClass: 'bg-danger', labelClass: 'text-danger' };
  }
}

export const StatusPill = ({ phase, connection }: Props) => {
  const spec = specFor(phase, connection);
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-medium">
      <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', spec.dotClass)} />
      <span className={spec.labelClass}>{spec.label}</span>
    </span>
  );
};
