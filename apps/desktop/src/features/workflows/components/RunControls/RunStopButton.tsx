import { CircleStop } from 'lucide-react';
import { ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { OrchestratorAction } from '../OrchestratorStrip/OrchestratorAction';

type Props = {
  readonly hasStepInFlight: boolean;
  readonly disabled: boolean;
  readonly onStop: () => void;
};

const STOP_KEEPS = 'Everything it already wrote is kept.';

export const RunStopButton = ({ hasStepInFlight, disabled, onStop }: Props) => (
  <ConfirmPopover
    role="danger"
    icon={<CircleStop size={ICON_SIZE.control} aria-hidden />}
    title="Stop the run?"
    description={
      hasStepInFlight
        ? `The step in flight is cancelled and marked Skipped. ${STOP_KEEPS}`
        : STOP_KEEPS
    }
    confirmLabel="Stop run"
    align="end"
    onConfirm={onStop}
    trigger={({ arm }) => (
      <OrchestratorAction
        icon={CircleStop}
        label="Stop"
        variant="ghost"
        tone="danger"
        testId="run-stop"
        disabled={disabled}
        onClick={arm}
      />
    )}
  />
);
