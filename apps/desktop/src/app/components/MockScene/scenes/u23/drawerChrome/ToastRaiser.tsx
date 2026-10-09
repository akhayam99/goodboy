import { useEffect } from 'react';
import { useToast } from '../../../../../../shared/components/Toast';

const noop = () => undefined;

export const ToastRaiser = () => {
  const { showToast } = useToast();

  useEffect(() => {
    showToast({
      kind: 'info',
      title: 'Fix run started',
      message: 'Resolve retries is working on 3 notes.',
      persist: true,
      action: { label: 'Open run', onClick: noop },
    });
  }, [showToast]);

  return null;
};
