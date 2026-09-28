import { useMemo } from 'react';
import { useAppStore } from '../../../store';
import { useShowToast } from '../../../app/components/Toast/useShowToast';
import { copyText } from '../copyText';
import type { ActionEnv, ActionOrigin } from '../types';

type Params = {
  readonly origin: ActionOrigin;
  readonly anchorKey?: string | null;
};

export const useActionEnv = ({ origin, anchorKey = null }: Params): ActionEnv => {
  const showToast = useShowToast();
  return useMemo<ActionEnv>(
    () => ({
      getState: useAppStore.getState,
      showToast,
      copyText: ({ text }) => copyText({ text, showToast }),
      origin,
      anchorKey,
    }),
    [anchorKey, origin, showToast],
  );
};
