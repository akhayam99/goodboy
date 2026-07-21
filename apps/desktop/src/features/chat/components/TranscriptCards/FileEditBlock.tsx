import { ArrowUpRight, FileEdit } from 'lucide-react';
import { displayPath } from '../../../../shared/utils/display-path';
import { TranscriptShell } from '../TranscriptShell';
import { MARKER_ACCENT } from '../marker-accents';

const infoAccent = MARKER_ACCENT.info;

const EDIT_LABEL: Record<'create' | 'modify' | 'delete', string> = {
  create: 'created',
  modify: 'modified',
  delete: 'deleted',
};

type Props = {
  path: string;
  editType: 'create' | 'modify' | 'delete';
  workingDir?: string | null;
  onOpenDiff?: (filePath: string) => void;
};

export const FileEditBlock = ({ path, editType, workingDir, onOpenDiff }: Props) => {
  const rel = displayPath(path, workingDir);
  const inner = (
    <>
      <FileEdit size={11} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className={`text-2xs uppercase tracking-wide ${infoAccent.text}`}>
        {EDIT_LABEL[editType]}
      </span>
      <code className="min-w-0 truncate font-mono text-xs text-foreground/80" title={path}>
        {rel}
      </code>
      {onOpenDiff ? (
        <ArrowUpRight
          size={11}
          aria-hidden
          className={`ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${infoAccent.icon}`}
        />
      ) : null}
    </>
  );

  if (onOpenDiff) {
    return (
      <TranscriptShell
        as="button"
        type="button"
        onClick={() => onOpenDiff(path)}
        title="View file"
        aria-label="View file"
        tone="info"
        variant="boxed"
        className="group inline-flex w-fit max-w-full cursor-pointer items-center gap-2 transition-opacity hover:opacity-80"
      >
        {inner}
      </TranscriptShell>
    );
  }

  return (
    <TranscriptShell
      tone="info"
      variant="boxed"
      className="group inline-flex w-fit max-w-full items-center gap-2"
    >
      {inner}
    </TranscriptShell>
  );
};
