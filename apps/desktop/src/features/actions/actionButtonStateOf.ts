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
  return {
    isPending,
    isBusy: isPending || isBusy,
    label: isPending ? (pendingLabel ?? label) : label,
  };
};
