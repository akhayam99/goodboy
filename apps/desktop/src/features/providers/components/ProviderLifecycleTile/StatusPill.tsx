import { StatusDot, type Tone } from '@goodboy/ui';
import type { ProviderConnectionState } from '../../../../features/providers/providers';

type Props = {
  readonly connection: ProviderConnectionState;
};

type PillSpec = {
  readonly label: string;
  readonly tone: Tone;
  readonly dotClassName?: string;
  readonly labelClass: string;
};

function connectionSpec(connection: ProviderConnectionState): PillSpec {
  switch (connection) {
    case 'connected':
      return { label: 'Connected', tone: 'primary', labelClass: 'text-primary' };
    case 'installed_disconnected':
      return { label: 'Not signed in', tone: 'warning', labelClass: 'text-warning' };
    case 'missing':
      return {
        label: 'Not installed',
        tone: 'neutral',
        dotClassName: 'bg-muted-foreground/40',
        labelClass: 'text-muted-foreground',
      };
    case 'error':
      return { label: 'Error', tone: 'danger', labelClass: 'text-danger' };
  }
}

export const StatusPill = ({ connection }: Props) => {
  const spec = connectionSpec(connection);
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-medium">
      <StatusDot tone={spec.tone} size="sm" className={spec.dotClassName} />
      <span className={spec.labelClass}>{spec.label}</span>
    </span>
  );
};
