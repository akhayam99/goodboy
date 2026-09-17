import { Copy, FileDown, Printer } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { useArtifactExport, type ArtifactExportStatus } from '../../hooks/useArtifactExport';

type Props = {
  readonly artifact: SessionArtifact;
};

const STATUS_COPY = {
  copied: 'copied to the clipboard',
  cancelled: 'save cancelled',
  printing: 'the print window is open',
} as const;

const statusNote = ({ status }: { readonly status: ArtifactExportStatus }): string | null => {
  if (status.kind === 'saved') {
    return `saved to ${status.path}`;
  }
  if (status.kind === 'copied' || status.kind === 'cancelled' || status.kind === 'printing') {
    return STATUS_COPY[status.kind];
  }
  return null;
};

export const ArtifactExportActions = ({ artifact }: Props) => {
  const { status, sourceActionLabel, canSavePdf, pdfHint, copySource, saveSource, savePdf } =
    useArtifactExport({ artifact });
  const hasFailed = status.kind === 'failed';
  const message = hasFailed ? status.message : statusNote({ status });

  return (
    <span data-testid="artifact-export-slot" className="flex min-w-0 items-center gap-2">
      <span
        data-testid="artifact-export-status"
        aria-live={hasFailed ? 'assertive' : 'polite'}
        title={message ?? undefined}
        className={cn(
          'min-w-0 max-w-40 shrink truncate text-right text-2xs',
          hasFailed ? 'text-danger' : 'text-muted-foreground',
        )}
      >
        {message}
      </span>
      <span data-testid="artifact-export-controls" className="flex shrink-0 items-center gap-1">
        <IconButton
          variant="ghost"
          icon={Copy}
          label="Copy"
          tooltip="Copy the source to the clipboard"
          onClick={() => void copySource()}
          disabled={status.kind === 'busy'}
          data-testid="artifact-copy-source"
        />
        <IconButton
          variant="ghost"
          icon={FileDown}
          label={sourceActionLabel}
          onClick={() => void saveSource()}
          disabled={status.kind === 'busy'}
          data-testid="artifact-save-source"
        />
        <span title={pdfHint} className="inline-flex">
          <IconButton
            variant="ghost"
            icon={Printer}
            label="Save PDF"
            tooltip={pdfHint}
            onClick={() => void savePdf()}
            disabled={status.kind === 'busy' || !canSavePdf}
            data-testid="artifact-save-pdf"
          />
        </span>
      </span>
    </span>
  );
};
