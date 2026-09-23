import { IconButton, cn, tintClasses } from '@goodboy/ui';
import { Check, X } from 'lucide-react';

type Props = {
  readonly isBusy: boolean;
  readonly onSave: () => void;
  readonly onCancel: () => void;
};

export const SaveCancel = ({ isBusy, onSave, onCancel }: Props) => {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <IconButton
        icon={Check}
        iconSize={14}
        label="Save"
        onClick={onSave}
        disabled={isBusy}
        busy={isBusy}
        className={cn(
          'border-primary bg-primary text-on-tone hover:border-primary',
          tintClasses('primary').hoverBg,
          'hover:text-on-tone',
        )}
      />
      <IconButton icon={X} iconSize={14} label="Cancel" onClick={onCancel} disabled={isBusy} />
    </div>
  );
};
