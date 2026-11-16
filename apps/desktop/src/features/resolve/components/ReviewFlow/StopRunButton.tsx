import { Square } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';

const STOP_LOOK = actionButtonLookOf({ verb: 'stop', variant: 'quiet' });

type Props = {
  readonly onStop: () => void;
  readonly label?: string;
};

const STOP_COPY = {
  label: 'Stop',
  title: 'Stop this fix run?',
  description: 'Comments it has not finished stay open and can be fixed again.',
} as const;

export const StopRunButton = ({ onStop, label = STOP_COPY.label }: Props) => (
  <ConfirmPopover
    role="danger"
    icon={<Square size={ICON_SIZE.row} aria-hidden />}
    title={STOP_COPY.title}
    description={STOP_COPY.description}
    confirmLabel={STOP_COPY.label}
    onConfirm={onStop}
    trigger={({ isArmed, arm }) => (
      <Button
        size="xs"
        variant={STOP_LOOK.variant}
        intent={STOP_LOOK.intent}
        aria-expanded={isArmed}
        aria-haspopup="dialog"
        onClick={arm}
      >
        {label}
      </Button>
    )}
  />
);
