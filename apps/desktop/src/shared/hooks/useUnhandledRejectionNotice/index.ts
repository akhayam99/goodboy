import { useEffect } from 'react';
import { useAppStore } from '../../../store';
import { formatError } from '../../lib/errors';

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
        .emitNotification(
          'error',
          'warning',
          'an action failed in the background',
          formatError(event.reason),
        )
        .catch(() => undefined)
        .finally(() => {
          isNotifying = false;
        });
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }, []);
};
