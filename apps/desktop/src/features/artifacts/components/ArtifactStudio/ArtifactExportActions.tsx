import { Copy, FileDown, Printer } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { useArtifactExport, type ArtifactExportStatus } from '../../hooks/useArtifactExport';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

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
  const note = statusNote({ status });

  return (
    <span data-testid="artifact-export-slot" className="flex shrink-0 items-center gap-2">
      {status.kind === 'failed' ? (
        <span
          role="alert"
          className="max-w-64 truncate text-2xs text-danger"
          title={status.message}
        >
          {status.message}
        </span>
      ) : null}
      {note === null ? null : (
        <span className="max-w-64 truncate text-2xs text-muted-foreground" title={note}>
          {note}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void copySource()}
        disabled={status.kind === 'busy'}
        data-testid="artifact-copy-source"
      >
        <Copy size={ICON_SIZE.row} aria-hidden />
        Copy
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void saveSource()}
        disabled={status.kind === 'busy'}
        data-testid="artifact-save-source"
      >
        <FileDown size={ICON_SIZE.row} aria-hidden />
        {sourceActionLabel}
      </Button>
      <span title={pdfHint} className="inline-flex">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void savePdf()}
          disabled={status.kind === 'busy' || !canSavePdf}
          data-testid="artifact-save-pdf"
        >
          <Printer size={ICON_SIZE.row} aria-hidden />
          Save PDF
        </Button>
      </span>
    </span>
  );
};
