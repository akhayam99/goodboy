import { useState } from 'react';
import { Copy, Printer } from 'lucide-react';
import { Button, formatError, KbdPill } from '@goodboy/ui';
import type { SessionArtifact } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { artifactExportContents } from '../../../artifacts/hooks/useArtifactExport/artifactSourceExport';

type Props = {
  readonly artifact: SessionArtifact;
  readonly onPrint: () => void;
};

type Note = Readonly<{ text: string; isError: boolean }>;

export const ReaderToolbar = ({ artifact, onPrint }: Props) => {
  const [note, setNote] = useState<Note | null>(null);

  const copy = () => {
    const clipboard = globalThis.navigator?.clipboard ?? null;
    if (clipboard === null) {
      setNote({ text: 'This system has no clipboard available', isError: true });
      return;
    }
    const contents = artifactExportContents({
      sourceFormat: artifact.sourceFormat,
      sourceText: artifact.sourceText,
    });
    clipboard
      .writeText(contents)
      .then(() => setNote({ text: 'Copied to the clipboard', isError: false }))
      .catch((cause: unknown) => setNote({ text: formatError(cause), isError: true }));
  };

  return (
    <div
      data-testid="reader-toolbar"
      role="toolbar"
      aria-label="Document"
      className="reader-toolbar"
    >
      <span className="reader-toolbar-title">{artifact.title}</span>
      {note === null ? null : (
        <span role={note.isError ? 'alert' : 'status'} className="reader-toolbar-note">
          {note.text}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={copy}>
        <Copy size={ICON_SIZE.row} aria-hidden />
        Copy
      </Button>
      <Button variant="secondary" size="sm" onClick={onPrint}>
        <Printer size={ICON_SIZE.row} aria-hidden />
        Print
        <KbdPill>⌘P</KbdPill>
      </Button>
    </div>
  );
};
