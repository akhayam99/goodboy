import { useEffect, useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { cn, Popover } from '@goodboy/ui';
import { openInEditor } from '../../../../shared/lib/editor';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';

interface OpenInEditorIconButtonProps {
  readonly worktreePath: string | null;
}

/**
 * Compact icon-only "open this session's worktree in an external editor"
 * affordance for header chrome. Click behaviour:
 * - 0 editors detected → disabled
 * - 1 editor → opens directly
 * - 2+ editors → opens a centered popover; picking an entry triggers the
 *   launch immediately (no remembered default, no select state — every
 *   pick is just a one-shot action).
 */
export function OpenInEditorIconButton({ worktreePath }: OpenInEditorIconButtonProps) {
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const launch = async (binary: string) => {
    if (!worktreePath) return;
    setOpen(false);
    try {
      await openInEditor(worktreePath, binary);
    } catch (err) {
      showToast('error', `couldn't open editor: ${formatError(err)}`);
    }
  };

  const disabled = !worktreePath || detectedEditors.length === 0;
  const hasMultiple = detectedEditors.length > 1;

  const onClick = () => {
    if (disabled) return;
    if (hasMultiple) {
      setOpen((v) => !v);
    } else {
      void launch(detectedEditors[0]!.binary);
    }
  };

  const title = disabled
    ? detectedEditors.length === 0
      ? 'no editor detected'
      : 'no worktree available'
    : hasMultiple
      ? 'open worktree in editor'
      : `open in ${detectedEditors[0]!.label}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        aria-haspopup={hasMultiple ? 'menu' : undefined}
        aria-expanded={hasMultiple ? open : undefined}
        className={cn(
          'shrink-0 rounded p-1 motion-safe:transition-colors',
          disabled
            ? 'cursor-not-allowed text-muted-foreground/30'
            : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground',
          open && 'bg-foreground/10 text-foreground',
        )}
      >
        <FolderOpen size={13} aria-hidden />
      </button>
      {open && hasMultiple ? (
        <Popover
          role="menu"
          className="absolute left-1/2 top-full z-30 mt-1 min-w-[160px] -translate-x-1/2 py-1"
        >
          {detectedEditors.map((ed) => (
            <button
              key={ed.binary}
              type="button"
              role="menuitem"
              onClick={() => void launch(ed.binary)}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
            >
              <FolderOpen size={11} aria-hidden className="text-muted-foreground/60" />
              <span className="flex-1 truncate">{ed.label}</span>
            </button>
          ))}
        </Popover>
      ) : null}
    </div>
  );
}
