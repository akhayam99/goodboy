import { useMemo } from 'react';
import { useAppStore } from '../../../store';
import { useShowToast } from '../../../app/components/Toast/useShowToast';
import { copyText } from '../copyText';
import type { ActionEnv, ActionOrigin, ActionViewing } from '../types';

type Params = {
  readonly origin: ActionOrigin;
  readonly anchorKey?: string | null;
  readonly viewing?: ActionViewing | null;
};

export const useActionEnv = ({ origin, anchorKey = null, viewing = null }: Params): ActionEnv => {
  const showToast = useShowToast();
  const viewingKind = viewing?.kind ?? null;
  const viewingId = viewing?.id ?? null;
  return useMemo<ActionEnv>(
    () => ({
      getState: useAppStore.getState,
      showToast,
      copyText: ({ text }) => copyText({ text, showToast }),
      origin,
      anchorKey,
      viewing:
        viewingKind === null || viewingId === null ? null : { kind: viewingKind, id: viewingId },
    }),
    [anchorKey, origin, showToast, viewingId, viewingKind],
  );
};
