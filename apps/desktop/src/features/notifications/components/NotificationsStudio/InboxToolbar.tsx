import { CheckCheck, Trash2 } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';

type Props = {
  readonly unreadCount: number;
  readonly isArmed: boolean;
  readonly onArm: () => void;
  readonly onDisarm: () => void;
  readonly onMarkAllRead: () => void;
  readonly onDeleteAll: () => Promise<void>;
};

export const InboxToolbar = ({
  unreadCount,
  isArmed,
  onArm,
  onDisarm,
  onMarkAllRead,
  onDeleteAll,
}: Props) => {
  if (isArmed) {
    return (
      <InlineConfirm
        className="w-80"
        role="danger"
        icon={<Trash2 size={12} aria-hidden />}
        title="Delete every notification?"
        description="This clears the whole history for good. Nothing here can be recovered."
        confirmLabel="Delete all"
        onConfirm={onDeleteAll}
        onCancel={onDisarm}
      />
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={onMarkAllRead}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
        >
          <CheckCheck size={12} aria-hidden />
          Mark all read
        </button>
      )}
      <button
        type="button"
        onClick={onArm}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium text-muted-foreground motion-safe:transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={12} aria-hidden />
        Delete all
      </button>
    </div>
  );
};
