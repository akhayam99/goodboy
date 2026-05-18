import { Dialog } from '@kay-am/ui';
import { RotateCcw } from 'lucide-react';
import type { WorkspaceInitScript } from '@kay-am/db';

interface InitScriptHistoryDialogProps {
  readonly open: boolean;
  readonly entries: ReadonlyArray<WorkspaceInitScript>;
  readonly onRestore: (entry: WorkspaceInitScript) => void;
  readonly onClose: () => void;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function InitScriptHistoryDialog({
  open,
  entries,
  onRestore,
  onClose,
}: InitScriptHistoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="init script history" size="xl">
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">no history yet</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs text-muted-foreground">
                  {formatRelative(entry.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  title="restore this version"
                  aria-label="restore"
                  className="ml-auto flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw size={10} aria-hidden />
                  restore
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground line-clamp-6">
                {entry.content}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
