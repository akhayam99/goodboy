import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderOpen } from 'lucide-react';
import { Button, Tooltip, cn, type ButtonSize, type ButtonVariant } from '@kay-am/ui';
import { openInEditor } from '../shared/lib/editor';
import { formatError } from '../shared/lib/errors';
import { DEFAULT_EDITOR_BINARY, SETTING_DEFAULT_EDITOR, SETTING_EDITOR_BINARY } from '../settings';
import { useAppStore } from '../store';

interface OpenInEditorButtonProps {
  worktreePath: string | null;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function OpenInEditorButton({
  worktreePath,
  size = 'sm',
  variant = 'secondary',
}: OpenInEditorButtonProps) {
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const globalEditorBinary = useAppStore(
    (s) => s.settings[SETTING_EDITOR_BINARY] ?? DEFAULT_EDITOR_BINARY,
  );
  const savedDefault = useAppStore((s) => s.settings[SETTING_DEFAULT_EDITOR] ?? null);
  const saveSetting = useAppStore((s) => s.saveSetting);

  const resolvedDefault = savedDefault ?? globalEditorBinary;

  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const open = async (binary: string) => {
    if (!worktreePath) return;
    setError(null);
    try {
      await openInEditor(worktreePath, binary);
      if (binary !== resolvedDefault) {
        await saveSetting(SETTING_DEFAULT_EDITOR, binary);
      }
    } catch (err) {
      setError(formatError(err));
    }
    setDropdownOpen(false);
  };

  const disabled = worktreePath === null;
  const title = disabled ? 'no worktree available' : (error ?? undefined);

  const hasMultiple = detectedEditors.length > 1;

  if (!hasMultiple) {
    return (
      <Button
        size={size}
        variant={variant}
        disabled={disabled}
        title={title}
        onClick={() => void open(resolvedDefault)}
      >
        <FolderOpen size={12} aria-hidden />
        Open in {resolvedDefault}
      </Button>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex">
        <Button
          size={size}
          variant={variant}
          disabled={disabled}
          title={title}
          className="rounded-r-none"
          onClick={() => void open(resolvedDefault)}
        >
          <FolderOpen size={12} aria-hidden />
          open in {resolvedDefault}
        </Button>
        <Tooltip content="choose editor" side="bottom">
          <Button
            size={size}
            variant={variant}
            disabled={disabled}
            aria-label="choose editor"
            className="rounded-l-none border-l border-border px-1"
            onClick={() => setDropdownOpen((v) => !v)}
          >
            <ChevronDown size={10} aria-hidden />
          </Button>
        </Tooltip>
      </div>

      {dropdownOpen ? (
        <div className="absolute right-0 top-full z-20 mt-0.5 min-w-[160px] rounded-md border border-border bg-background py-1 shadow-md text-xs">
          {detectedEditors.map((ed) => (
            <button
              key={ed.binary}
              type="button"
              onClick={() => void open(ed.binary)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted',
                ed.binary === resolvedDefault && 'font-medium text-foreground',
              )}
            >
              {ed.label}
              {ed.binary === resolvedDefault ? (
                <span className="ml-auto text-2xs text-muted-foreground">default</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
