import { useState } from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { BulkArchiveSessionsConfirm } from '../../../session/components/BulkArchiveSessionsConfirm';
import { BulkDeleteSessionsConfirm } from '../../../session/components/BulkDeleteSessionsConfirm';

type BulkScope = 'active' | 'archived';

type Props = {
  readonly scope: BulkScope;
  readonly sessions: ReadonlyArray<Session>;
  readonly onSelectAll: () => void;
  readonly onClear: () => void;
  readonly className?: string;
};

export const BulkActionBar = ({ scope, sessions, onSelectAll, onClear, className }: Props) => {
  const bulkUnarchiveTask = useAppStore((s) => s.bulkUnarchiveTask);
  const [pending, setPending] = useState<'archive' | 'delete' | null>(null);

  const count = sessions.length;
  if (count === 0) {
    return null;
  }

  const onRestore = async () => {
    await bulkUnarchiveTask(sessions.map((s) => s.id as SessionId));
    onClear();
  };

  if (pending === 'archive') {
    return (
      <BulkArchiveSessionsConfirm
        sessions={sessions}
        onClose={() => setPending(null)}
        onConfirmed={onClear}
        className={className}
      />
    );
  }

  if (pending === 'delete') {
    return (
      <BulkDeleteSessionsConfirm
        sessions={sessions}
        onClose={() => setPending(null)}
        onConfirmed={onClear}
        className={className}
      />
    );
  }

  return (
    <div
      role="group"
      aria-label={`${count} sessions selected`}
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-lg border border-border-soft bg-subtle px-2 py-1.5',
        className,
      )}
    >
      <span className="mr-auto text-xs font-medium text-foreground">{count} selected</span>
      {scope === 'active' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPending('archive')}
          title="Archive selected sessions"
          className="shrink-0 gap-1 px-2 text-xs"
        >
          <Archive size={11} aria-hidden />
          Archive ({count})
        </Button>
      )}
      {scope === 'archived' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void onRestore()}
          title="Restore selected sessions"
          className="shrink-0 gap-1 px-2 text-xs"
        >
          <RotateCcw size={11} aria-hidden />
          Restore ({count})
        </Button>
      )}
      <Button
        variant="danger"
        size="sm"
        onClick={() => setPending('delete')}
        title="Delete selected sessions"
        className="shrink-0 gap-1 px-2 text-xs"
      >
        <Trash2 size={11} aria-hidden />
        Delete ({count})
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onSelectAll}
        title="Select every session in view"
        className="shrink-0 px-2 text-xs"
      >
        All
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        title="Clear selection"
        className="shrink-0 px-2 text-xs"
      >
        Clear
      </Button>
    </div>
  );
};
