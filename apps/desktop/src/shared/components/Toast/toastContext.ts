import { createContext } from 'react';
import type { ToastAction, ToastKind } from './types';

type ShowToastKind = Exclude<ToastKind, 'error'>;

export type ShowToastParams = {
  readonly kind: ShowToastKind;
  readonly message: string;
  readonly title?: string;
  readonly context?: string;
  readonly persist?: boolean;
  readonly action?: ToastAction;
  readonly onDismiss?: () => void;
};

export type ShowToast = (params: ShowToastParams) => void;

export type PreviewNotificationParams = {
  readonly severity: ToastKind;
  readonly title: string;
  readonly message: string;
  readonly context?: string;
  readonly action?: ToastAction;
  readonly persist: boolean;
  readonly onDismiss?: () => void;
};

export type ToastContextValue = {
  showToast: ShowToast;
  previewNotification: (params: PreviewNotificationParams) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
