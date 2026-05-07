import { useState } from 'react';
import { Button } from '@kay-am/ui';
import type { ButtonProps } from '@kay-am/ui';
import { openInEditor } from '../editor';
import { DEFAULT_EDITOR_BINARY, SETTING_EDITOR_BINARY } from '../settings';
import { useAppStore } from '../store';

interface OpenInEditorButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  worktreePath: string | null;
  label?: string;
}

export function OpenInEditorButton({
  worktreePath,
  label,
  size = 'sm',
  variant = 'ghost',
  ...rest
}: OpenInEditorButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const editorBinary = useAppStore(
    (s) => s.settings[SETTING_EDITOR_BINARY] ?? DEFAULT_EDITOR_BINARY,
  );
  const resolvedLabel = label ?? `open in ${editorBinary}`;

  const onClick = async () => {
    if (!worktreePath) return;
    setError(null);
    try {
      await openInEditor(worktreePath, editorBinary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const disabled = rest.disabled || worktreePath === null;
  const tooltip =
    worktreePath === null
      ? 'session has no worktree (worktree paths are not yet persisted across restarts)'
      : (error ?? undefined);

  return (
    <Button
      {...rest}
      size={size}
      variant={variant}
      disabled={disabled}
      title={tooltip}
      onClick={() => void onClick()}
    >
      {resolvedLabel}
    </Button>
  );
}
