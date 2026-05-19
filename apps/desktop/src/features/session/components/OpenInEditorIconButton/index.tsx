import { useEffect, useRef, useState } from 'react';
import { Check, FolderOpen } from 'lucide-react';
import { cn } from '@kay-am/ui';
import { openInEditor } from '../../../../shared/lib/editor';
import { formatError } from '../../../../shared/lib/errors';
import {
  DEFAULT_EDITOR_BINARY,
  SETTING_DEFAULT_EDITOR,
  SETTING_EDITOR_BINARY,
} from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

interface OpenInEditorIconButtonProps {
  readonly worktreePath: string | null;
}

/**
 * Compact icon-only "open this session's worktree in an external editor"
 * affordance. Intended for header chrome (e.g. the session detail panel)
 * where space is tight and a labelled button would clash. Click behaviour:
 * - 0 editors detected → disabled
 * - 1 editor → opens directly
 * - 2+ editors → opens a small popover. Last picked editor is remembered.
 */
export function OpenInEditorIconButton({ worktreePath }: OpenInEditorIconButtonProps) {
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const globalEditorBinary = useAppStore(
    (s) => s.settings[SETTING_EDITOR_BINARY] ?? DEFAULT_EDITOR_BINARY,
  );
  const savedDefault = useAppStore((s) => s.settings[SETTING_DEFAULT_EDITOR] ?? null);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const { showToast } = useToast();

  const resolvedDefault = savedDefault ?? globalEditorBinary;

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
      if (binary !== resolvedDefault) {
        await saveSetting(SETTING_DEFAULT_EDITOR, binary);
      }
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
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-md border border-border bg-subtle py-1 text-xs shadow-lg"
        >
          {detectedEditors.map((ed) => {
            const active = ed.binary === resolvedDefault;
            return (
              <button
                key={ed.binary}
                type="button"
                role="menuitem"
                onClick={() => void launch(ed.binary)}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left motion-safe:transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <FolderOpen
                  size={11}
                  aria-hidden
                  className={active ? 'text-primary' : 'text-muted-foreground/60'}
                />
                <span className="flex-1 truncate">{ed.label}</span>
                {active ? <Check size={11} className="text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
