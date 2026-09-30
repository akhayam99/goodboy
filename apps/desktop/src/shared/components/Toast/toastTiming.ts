export const TOAST_DURATION_MS = 5000;
export const TOAST_ACTION_DURATION_MS = 10000;

type ToastDurationParams = {
  readonly persist: boolean;
  readonly hasAction: boolean;
};

export const toastDuration = ({ persist, hasAction }: ToastDurationParams): number | null => {
  if (persist) {
    return null;
  }
  if (hasAction) {
    return TOAST_ACTION_DURATION_MS;
  }
  return TOAST_DURATION_MS;
};
