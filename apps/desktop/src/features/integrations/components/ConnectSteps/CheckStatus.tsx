import { StatusDot } from '@goodboy/ui';
import { Check, ShieldAlert } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly status: 'idle' | 'checking' | 'ok' | 'error';
  readonly checkingLabel: string;
  readonly okLabel: string | null;
  readonly error: string | null;
};

export const CheckStatus = ({ status, checkingLabel, okLabel, error }: Props) => {
  if (status === 'checking') {
    return (
      <span
        role="status"
        className="flex items-center gap-1.5 text-secondary text-muted-foreground"
      >
        <StatusDot tone="info" size="sm" pulsing />
        {checkingLabel}
      </span>
    );
  }
  if (status === 'ok' && okLabel !== null) {
    return (
      <span role="status" className="flex items-center gap-1.5 text-secondary text-success">
        <Check size={ICON_SIZE.row} aria-hidden />
        {okLabel}
      </span>
    );
  }
  if (status === 'error' && error !== null) {
    return (
      <span role="alert" className="flex items-start gap-1.5 text-secondary text-danger">
        <ShieldAlert size={ICON_SIZE.row} aria-hidden className="mt-0.5 shrink-0" />
        {error}
      </span>
    );
  }
  return null;
};
