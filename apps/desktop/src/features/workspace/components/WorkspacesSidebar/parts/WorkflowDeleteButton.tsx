import { Trash2 } from 'lucide-react';
import { ConfirmPopover, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly onConfirm: () => void;
};

export const WorkflowDeleteButton = ({ onConfirm }: Props) => (
  <ConfirmPopover
    role="danger"
    icon={<Trash2 size={ICON_SIZE.control} aria-hidden />}
    title="Delete workflow run?"
    description="Permanently removes this workflow run from the session."
    confirmLabel="Delete"
    onConfirm={onConfirm}
    trigger={({ isArmed, arm }) => (
      <button
        type="button"
        onClick={arm}
        aria-expanded={isArmed}
        className={cn(
          'inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-2 text-2xs font-semibold',
          tintClasses('danger').text,
          'motion-safe:transition-colors',
          tintClasses('danger').hoverBg,
          'hover:text-danger',
        )}
      >
        <Trash2 size={ICON_SIZE.control} aria-hidden />
        Delete
      </button>
    )}
  />
);
