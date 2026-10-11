import { Archive } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  readonly isBusy: boolean;
  readonly onConfirm: () => void;
};

export const ForgetSavedButton = ({ isBusy, onConfirm }: Props) => (
  <ConfirmPopover
    role="alert"
    icon={<Archive size={ICON_SIZE.control} aria-hidden />}
    title="Forget the saved files?"
    description="They stay in the stash, with a safety copy for 14 days."
    confirmLabel="Done, forget it"
    isBusy={isBusy}
    align="start"
    onConfirm={onConfirm}
    trigger={({ isArmed, arm }) => (
      <Button
        size="sm"
        variant="ghost"
        aria-expanded={isArmed}
        aria-haspopup="dialog"
        disabled={isBusy}
        onClick={arm}
      >
        Done, forget it
      </Button>
    )}
  />
);
