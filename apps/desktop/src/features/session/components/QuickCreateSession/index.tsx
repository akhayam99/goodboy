import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

export const QuickCreateSession = ({ workspaceId, onClose }: Props) => {
  const createSession = useAppStore((s) => s.createSession);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const goal = title.trim();
    if (goal.length === 0 || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createSession({ workspaceId, goal });
      onClose();
    } catch (createError) {
      setError(formatError(createError));
      setBusy(false);
    }
  };

  return (
    <div
      className="flex h-full w-full items-start justify-center bg-background/80 pt-[20vh] backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-label="New session"
        className="flex w-full max-w-lg flex-col gap-2 rounded-xl border border-border-soft bg-elevated p-3 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="text"
          value={title}
          autoFocus
          aria-label="Session title"
          placeholder="Name the session, everything else happens inside"
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submit();
            }
          }}
          className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {busy ? 'Creating…' : 'Enter to create, Esc to dismiss'}
          </span>
          {error !== null ? (
            <span role="alert" className="text-xs text-danger">
              {error}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
