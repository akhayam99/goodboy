import type { ActionControls } from './useActionControls';

type Params = {
  readonly controls: ActionControls | null;
  readonly actionId: string;
  readonly label: string;
  readonly pendingLabel: string | null;
  readonly isBusy?: boolean;
};

export type ActionButtonState = {
  readonly isPending: boolean;
  readonly isBusy: boolean;
  readonly label: string;
};

export const actionButtonStateOf = ({
  controls,
  actionId,
  label,
  pendingLabel,
  isBusy = false,
}: Params): ActionButtonState => {
  const isPending = controls !== null && controls.pendingId === actionId;
  if (!isPending) {
    return { isPending, isBusy, label };
  }
  const word = pendingLabel ?? label;
  const seconds = controls.pendingSeconds;
  return {
    isPending,
    isBusy: true,
    label: seconds === null ? word : `${word} ${seconds}s`,
  };
};
