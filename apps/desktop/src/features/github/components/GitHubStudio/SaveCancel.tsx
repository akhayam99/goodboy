import { IconButton } from '@goodboy/ui';
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
        className="border-primary bg-primary text-primary-foreground hover:border-primary hover:bg-primary/90 hover:text-primary-foreground"
      />
      <IconButton icon={X} iconSize={14} label="Cancel" onClick={onCancel} disabled={isBusy} />
    </div>
  );
};
