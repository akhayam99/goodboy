import { ICON_SIZE, StatusDot } from '@goodboy/ui';
import { Check, CircleAlert } from '@goodboy/ui/icons';

type Props = {
  readonly status: 'idle' | 'checking' | 'ok' | 'error';
  readonly checkingLabel: string;
  readonly okLabel: string | null;
  readonly error: string | null;
};

export const CheckStatus = ({ status, checkingLabel, okLabel, error }: Props) => {
  if (status === 'checking') {
    return (
      <span role="status" className="flex items-center gap-1 text-meta text-muted-foreground">
        <StatusDot tone="info" size="sm" pulsing />
        {checkingLabel}
      </span>
    );
  }
  if (status === 'ok' && okLabel !== null) {
    return (
      <span role="status" className="flex items-center gap-1 text-meta text-success">
        <Check size={ICON_SIZE.row} aria-hidden />
        {okLabel}
      </span>
    );
  }
  if (status === 'error' && error !== null) {
    return (
      <span role="alert" className="flex items-start gap-2 text-meta text-foreground">
        <span className="flex h-4 shrink-0 items-center">
          <CircleAlert size={ICON_SIZE.control} aria-hidden className="text-danger" />
        </span>
        <span className="min-w-0">{error}</span>
      </span>
    );
  }
  return null;
};
