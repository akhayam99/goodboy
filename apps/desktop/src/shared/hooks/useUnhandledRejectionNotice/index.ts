import { useEffect } from 'react';
import { formatError } from '@goodboy/ui';
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
        .emitNotification({
          kind: 'error',
          severity: 'warning',
          title: 'an action failed in the background',
          body: formatError(event.reason),
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
