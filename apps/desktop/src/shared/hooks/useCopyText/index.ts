import { useCallback } from 'react';
import { copyToClipboard } from '@goodboy/ui';
import { useShowToast } from '../../components/Toast/useShowToast';

type Params = {
  readonly text: string;
};

export const useCopyText = (): ((params: Params) => Promise<void>) => {
  const showToast = useShowToast();
  return useCallback(
    async ({ text }: Params) => {
      try {
        await copyToClipboard({ text });
      } catch {
        showToast({
          kind: 'warning',
          title: 'Copy failed',
          message: 'The clipboard refused the text.',
        });
      }
    },
    [showToast],
  );
};
