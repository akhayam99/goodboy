import { Check, Copy, Pencil, Play, Square, Trash2 } from 'lucide-react';
import { StatusDot, cn } from '@goodboy/ui';
import type { WorkspaceScript } from '@goodboy/types';
import type { ScriptRunRecord } from '../../scripts';

type Props = {
  readonly script: WorkspaceScript;
  readonly run: ScriptRunRecord | null;
  readonly selected: boolean;
  readonly runnable: boolean;
  readonly canRun: boolean;
  readonly copied: boolean;
  readonly onSelect: () => void;
  readonly onRun: () => void;
  readonly onCancel: () => void;
  readonly onCopy: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
};

type Params = {
  readonly body: string;
};

const extractPreviewLine = ({ body }: Params): string => {
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    if (trimmed.startsWith('#!')) {
      continue;
    }
    return trimmed;
  }
  return '';
};

export const ScriptRow = ({
  script,
  run,
  selected,
  runnable,
  canRun,
  copied,
  onSelect,
  onRun,
  onCancel,
  onCopy,
  onEdit,
  onDelete,
}: Props) => {
  const preview = extractPreviewLine({ body: script.body });
  const isPending = run?.status === 'pending';
  const result = run?.result ?? null;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors',
        selected ? 'border-border bg-muted/50' : 'hover:bg-muted/40',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {isPending ? <StatusDot tone="info" pulsing ariaLabel="running" /> : null}
          {!isPending && result !== null ? (
            <StatusDot
              tone={result.exitCode === 0 ? 'success' : 'danger'}
              ariaLabel={result.exitCode === 0 ? 'Script run succeeded' : 'Script run failed'}
            />
          ) : null}
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {script.name}
          </span>
        </span>
        {preview !== '' ? (
          <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground">
            {preview}
          </span>
        ) : null}
      </button>

      {runnable ? (
        isPending ? (
          <button
            type="button"
            onClick={onCancel}
            title="Stop script"
            aria-label="Stop script"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10"
          >
            <Square size={11} fill="currentColor" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            title="Run script"
            aria-label="Run script"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play size={13} aria-hidden />
          </button>
        )
      ) : null}

      <button
        type="button"
        onClick={onCopy}
        title="Copy script"
        aria-label="Copy script"
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? (
          <Check size={13} aria-hidden className="text-success" />
        ) : (
          <Copy size={13} aria-hidden />
        )}
      </button>

      <button
        type="button"
        onClick={onEdit}
        title="Edit script"
        aria-label="Edit script"
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Pencil size={13} aria-hidden />
      </button>

      <button
        type="button"
        onClick={onDelete}
        title="Delete script"
        aria-label="Delete script"
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={13} aria-hidden />
      </button>
    </div>
  );
};
