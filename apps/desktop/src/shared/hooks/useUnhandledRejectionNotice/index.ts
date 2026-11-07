import { CHECK_STATE } from '../../../store/slices/notifications/errorRecovery';
import { useEffect } from 'react';
import { useAppStore } from '../../../store';

export const useUnhandledRejectionNotice = () => {
  useEffect(() => {
    let isNotifying = false;
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isNotifying) {
        return;
      }
      isNotifying = true;
      void useAppStore
        .getState()
        .reportError({
          recovery: CHECK_STATE,
          severity: 'warning',
          title: 'An action failed in the background',
          error: event.reason,
        })
        .catch(() => undefined)
        .finally(() => {
          isNotifying = false;
        });
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }, []);
};
