import { Button } from '@goodboy/ui';
import { AlertTriangle } from 'lucide-react';

type Props = {
  readonly label: string;
  readonly error: Error | null;
  readonly onRetry: () => void;
};

export const ErrorStrip = ({ label, error, onRetry }: Props) => {
  if (error === null) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
    >
      <AlertTriangle size={14} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1">
        Could not load {label}: {error.message}
      </span>
      <Button size="sm" variant="ghost" className="text-danger" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
};
