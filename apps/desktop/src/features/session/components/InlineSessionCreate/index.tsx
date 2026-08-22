import { useState } from 'react';
import { cn, formatError } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onDone: () => void;
  readonly className?: string;
};

export const InlineSessionCreate = ({ workspaceId, onDone, className }: Props) => {
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
      onDone();
    } catch (createError) {
      setError(formatError(createError));
      setBusy(false);
    }
  };

  return (
    <div
      role="group"
      aria-label="New session"
      className={cn(
        'flex w-full flex-col gap-1.5 rounded-lg border border-primary/40 bg-elevated px-2.5 py-2 focus-within:border-primary/70',
        className,
      )}
    >
      <input
        type="text"
        value={title}
        autoFocus
        aria-label="Session title"
        placeholder="Name the session, everything else happens inside"
        disabled={busy}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => {
          if (!busy && title.trim().length === 0) {
            onDone();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void submit();
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onDone();
          }
        }}
        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-muted-foreground/70">
          {busy ? 'Creating…' : 'Enter to create · Esc to dismiss'}
        </span>
        {error !== null ? (
          <span role="alert" className="truncate text-2xs text-danger">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
};
