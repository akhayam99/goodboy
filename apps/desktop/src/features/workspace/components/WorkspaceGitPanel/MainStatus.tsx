import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, FolderOpen, GitBranch, Pencil } from 'lucide-react';
import { Button, Chip, Eyebrow, formatError } from '@goodboy/ui';
import type { WorkspaceGitStatus } from '@goodboy/types';
import { openInEditor } from '../../../../shared/lib/editor';

type Props = {
  readonly rootPath: string;
  readonly status: WorkspaceGitStatus;
};

type Signal = {
  readonly key: string;
  readonly label: string;
  readonly icon: typeof ArrowUp;
};

const signalsOf = ({ status }: { readonly status: WorkspaceGitStatus }): ReadonlyArray<Signal> => {
  const signals: Array<Signal> = [];
  if (status.behind > 0) {
    signals.push({ key: 'behind', label: `${status.behind} to pull`, icon: ArrowDown });
  }
  if (status.ahead > 0) {
    signals.push({ key: 'ahead', label: `${status.ahead} to push`, icon: ArrowUp });
  }
  if (status.changed > 0) {
    signals.push({ key: 'dirty', label: `${status.changed} uncommitted`, icon: Pencil });
  }
  return signals;
};

export const MainStatus = ({ rootPath, status }: Props) => {
  const [openError, setOpenError] = useState<string | null>(null);
  const signals = signalsOf({ status });
  const branch = status.branch ?? 'detached HEAD';

  const onOpen = async () => {
    setOpenError(null);
    try {
      await openInEditor(rootPath);
    } catch (error) {
      setOpenError(formatError(error));
    }
  };

  return (
    <section aria-label="Main checkout" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow label="Main checkout" muted />
        <span className="flex min-w-0 items-center gap-1 text-xs text-foreground">
          <GitBranch size={11} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{branch}</span>
        </span>
        {signals.length === 0 ? (
          <span className="flex items-center gap-1 text-2xs text-muted-foreground">
            <Check size={11} aria-hidden />
            {status.hasUpstream ? 'In sync and clean' : 'Clean, no upstream yet'}
          </span>
        ) : (
          signals.map((signal) => (
            <Chip
              key={signal.key}
              size="sm"
              tone="neutral"
              icon={<signal.icon size={10} aria-hidden />}
              label={signal.label}
            />
          ))
        )}
        <span className="min-w-0 flex-1" aria-hidden />
        <Button size="sm" variant="ghost" onClick={() => void onOpen()}>
          <FolderOpen size={13} aria-hidden />
          Open main in editor
        </Button>
      </div>
      {openError != null ? (
        <span role="alert" className="text-2xs text-danger">
          {openError}
        </span>
      ) : (
        <span className="text-2xs text-muted-foreground/70">
          Sessions keep working in their own worktree, never on this checkout.
        </span>
      )}
    </section>
  );
};
