import { useState } from 'react';
import { Archive } from 'lucide-react';
import { InlineConfirm, ScrollFade } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';

type Props = {
  readonly sessions: ReadonlyArray<Session>;
  readonly onClose: () => void;
  readonly onConfirmed?: () => void;
  readonly className?: string;
};

export const BulkArchiveSessionsConfirm = ({
  sessions,
  onClose,
  onConfirmed,
  className,
}: Props) => {
  const bulkArchiveTask = useAppStore((s) => s.bulkArchiveTask);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = sessions.length;

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await bulkArchiveTask(sessions.map((s) => s.id as SessionId));
      onConfirmed?.();
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <InlineConfirm
      role="alert"
      icon={<Archive size={12} aria-hidden />}
      title={`Archive ${count} sessions?`}
      description="Moves these sessions out of the active board. Worktrees and transcripts are kept, restore them any time."
      confirmLabel={`Archive (${count})`}
      onConfirm={onConfirm}
      onCancel={onClose}
      isBusy={busy}
      className={className}
    >
      <ScrollFade
        fadeFrom="subtle"
        className="max-h-32 rounded-md border border-border-soft bg-subtle"
        viewportClassName="flex flex-col gap-1 px-2 py-1.5"
      >
        {sessions.map((session) => (
          <span key={session.id} className="truncate font-mono text-foreground">
            {session.goal}
          </span>
        ))}
      </ScrollFade>
      {error != null && <p className="font-medium text-danger">{error}</p>}
    </InlineConfirm>
  );
};
