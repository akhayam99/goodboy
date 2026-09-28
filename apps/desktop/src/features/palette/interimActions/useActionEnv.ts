import { useMemo } from 'react';
import { useAppStore } from '../../../store';
import { useToast } from '../../../app/components/Toast';
import type { ActionEnv } from './types';

export const useActionEnv = (): ActionEnv => {
  const { showToast } = useToast();
  return useMemo<ActionEnv>(
    () => ({
      getState: useAppStore.getState,
      showToast,
      copyText: async ({ text }) => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          showToast({
            kind: 'warning',
            title: 'Copy failed',
            message: 'The clipboard refused the text.',
          });
        }
      },
      origin: 'palette',
      anchorKey: null,
    }),
    [showToast],
  );
};
