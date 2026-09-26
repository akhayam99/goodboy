import { CheckCheck, Trash2 } from 'lucide-react';
import { InlineConfirm, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly unreadCount: number;
  readonly isArmed: boolean;
  readonly onArm: () => void;
  readonly onDisarm: () => void;
  readonly onMarkAllRead: () => void;
  readonly onDeleteAll: () => Promise<void>;
};

const GHOST =
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-secondary font-medium text-muted-foreground motion-safe:transition-colors';

export const NotificationsToolbar = ({
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
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title="Delete these notifications?"
        description="This clears the history shown here for good. Nothing here can be recovered."
        confirmLabel="Delete all"
        onConfirm={onDeleteAll}
        onCancel={onDisarm}
      />
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={onMarkAllRead}
          className={cn(GHOST, 'hover:bg-hover hover:text-foreground')}
        >
          <CheckCheck size={ICON_SIZE.row} aria-hidden />
          Mark all read
        </button>
      )}
      <button
        type="button"
        onClick={onArm}
        className={cn(GHOST, tintClasses('danger').hoverBg, 'hover:text-danger')}
      >
        <Trash2 size={ICON_SIZE.row} aria-hidden />
        Delete all
      </button>
    </div>
  );
};
