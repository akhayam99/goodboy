export type ToastKind = 'info' | 'warning' | 'error' | 'success';

export type ToastAction = {
  readonly label: string;
  readonly onClick: () => void;
};

export type ToastItem = {
  readonly id: string;
  readonly kind: ToastKind;
  readonly message: string;
  readonly title?: string;
  readonly context?: string;
  readonly persist: boolean;
  readonly action?: ToastAction;
  readonly onDismiss?: () => void;
  readonly count: number;
  readonly revision: number;
};
