import { cn } from '@goodboy/ui';
import type { ArtifactExportStatus as Status } from '../../hooks/useArtifactExport';

type Props = {
  readonly status: Status;
};

const noteOf = ({ status }: { readonly status: Status }): string | null => {
  switch (status.kind) {
    case 'saved':
      return `Saved to ${status.path}`;
    case 'copied':
      return 'Copied to the clipboard';
    case 'cancelled':
      return 'Save cancelled';
    case 'printing':
      return 'The print window is open';
    case 'failed':
      return status.message;
    case 'idle':
    case 'busy':
      return null;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};

export const ArtifactExportStatus = ({ status }: Props) => {
  const note = noteOf({ status });
  const hasFailed = status.kind === 'failed';
  return (
    <span
      data-testid="artifact-export-status"
      aria-live={hasFailed ? 'assertive' : 'polite'}
      title={note ?? undefined}
      className={cn(
        'min-w-0 max-w-48 truncate text-secondary',
        hasFailed ? 'text-danger' : 'text-muted-foreground',
      )}
    >
      {note}
    </span>
  );
};
