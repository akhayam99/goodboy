import { useState } from 'react';
import { Button } from '@kay-am/ui';
import type { ButtonProps } from '@kay-am/ui';
import { openInEditor } from '../editor';

interface OpenInEditorButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  worktreePath: string | null;
  label?: string;
}

export function OpenInEditorButton({
  worktreePath,
  label = 'open in vscode',
  size = 'sm',
  variant = 'ghost',
  ...rest
}: OpenInEditorButtonProps) {
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (!worktreePath) return;
    setError(null);
    try {
      await openInEditor(worktreePath);
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
      {label}
    </Button>
  );
}
