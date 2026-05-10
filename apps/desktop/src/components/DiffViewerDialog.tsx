import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, ScrollArea, cn } from '@kay-am/ui';
import { parseUnifiedDiff } from '@kay-am/core';
import type { FileDiff, FileDiffStatus } from '@kay-am/types';
import { ghPrDiff } from '../github';

interface DiffViewerDialogProps {
  open: boolean;
  onClose: () => void;
  repoSlug: string;
  prNumber: number;
  cwd?: string;
}

const STATUS_GLYPH: Record<FileDiffStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
};

const STATUS_COLOR: Record<FileDiffStatus, string> = {
  added: 'text-success',
  modified: 'text-info',
  deleted: 'text-danger',
  renamed: 'text-warning',
};

function truncatePathLeft(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path;
  return `…${path.slice(path.length - maxLen + 1)}`;
}

export function DiffViewerDialog({
  open,
  onClose,
  repoSlug,
  prNumber,
  cwd,
}: DiffViewerDialogProps) {
  const [files, setFiles] = useState<ReadonlyArray<FileDiff>>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSelectedIdx(0);
    ghPrDiff(repoSlug, prNumber, cwd)
      .then((raw) => {
        setFiles(parseUnifiedDiff(raw));
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [open, repoSlug, prNumber, cwd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'j') {
        setSelectedIdx((i) => Math.min(i + 1, files.length - 1));
      } else if (e.key === 'k') {
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
    },
    [files.length, onClose],
  );

  const selected = files[selectedIdx];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`pr #${prNumber} diff`}
      size="xl"
      fixedHeightClass="h-[80vh] max-w-6xl"
      className="w-[80vw] max-w-6xl"
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- dialog handles keyboard nav */}
      <div className="flex h-full min-h-0 flex-1 gap-0 overflow-hidden" onKeyDown={handleKeyDown}>
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            loading diff…
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center text-xs text-danger">{error}</div>
        ) : files.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            no diff available
          </div>
        ) : (
          <>
            <FileRail files={files} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-border-soft">
              {selected ? <FileDiffPane file={selected} /> : null}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

function FileRail({
  files,
  selectedIdx,
  onSelect,
}: {
  files: ReadonlyArray<FileDiff>;
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  return (
    <ScrollArea className="w-[30%] shrink-0 overflow-y-auto border-r border-border-soft">
      <ul className="flex flex-col py-1">
        {files.map((f, i) => (
          <li key={f.path}>
            <button
              ref={i === selectedIdx ? selectedRef : null}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs transition-colors',
                i === selectedIdx
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span className={cn('shrink-0 font-bold', STATUS_COLOR[f.status])}>
                {STATUS_GLYPH[f.status]}
              </span>
              <span className="min-w-0 flex-1 truncate" title={f.path}>
                {truncatePathLeft(f.path)}
              </span>
              <span className="shrink-0 text-[10px]">
                {f.additions > 0 ? <span className="text-success">+{f.additions}</span> : null}
                {f.additions > 0 && f.deletions > 0 ? (
                  <span className="text-muted-foreground">/</span>
                ) : null}
                {f.deletions > 0 ? <span className="text-danger">-{f.deletions}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

function FileDiffPane({ file }: { file: FileDiff }) {
  return (
    <ScrollArea className="flex-1 overflow-auto">
      <div className="p-3">
        {file.binary ? (
          <p className="py-4 text-center text-xs text-muted-foreground">binary file, no diff</p>
        ) : file.hunks.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">no changes</p>
        ) : (
          <table className="w-full border-collapse font-mono text-xs leading-5">
            <tbody>
              {file.hunks.map((hunk, hi) => (
                <>
                  <tr key={`hunk-${hi}-header`}>
                    <td
                      colSpan={3}
                      className="bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {hunk.header}
                    </td>
                  </tr>
                  {hunk.lines.map((line, li) => (
                    <tr
                      key={`hunk-${hi}-line-${li}`}
                      className={cn(
                        line.kind === 'add' && 'bg-success/10',
                        line.kind === 'del' && 'bg-danger/10',
                      )}
                    >
                      <td className="w-8 select-none px-1.5 text-right text-[10px] text-muted-foreground/60">
                        {line.oldLine ?? ''}
                      </td>
                      <td className="w-8 select-none px-1.5 text-right text-[10px] text-muted-foreground/60">
                        {line.newLine ?? ''}
                      </td>
                      <td
                        className={cn(
                          'whitespace-pre px-2',
                          line.kind === 'add' && 'text-success',
                          line.kind === 'del' && 'text-danger',
                        )}
                      >
                        {line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '}
                        {line.text}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ScrollArea>
  );
}
