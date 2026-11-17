import { Archive } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';

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
    confirmLabel="Forget saved files"
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
        Forget saved files
      </Button>
    )}
  />
);
