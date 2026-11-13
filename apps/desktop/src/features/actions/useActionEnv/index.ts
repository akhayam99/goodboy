import { useMemo } from 'react';
import { useAppStore } from '../../../store';
import { useShowToast } from '../../../shared/components/Toast/useShowToast';
import { useCopyText } from '../../../shared/hooks/useCopyText';
import type { ActionEnv, ActionOrigin, ActionViewing } from '../types';

type Params = {
  readonly origin: ActionOrigin;
  readonly anchorKey?: string | null;
  readonly viewing?: ActionViewing | null;
  readonly isOutcomeShown?: boolean;
  readonly hasRunSurface?: () => boolean;
};

export const useActionEnv = ({
  origin,
  anchorKey = null,
  viewing = null,
  isOutcomeShown = false,
  hasRunSurface,
}: Params): ActionEnv => {
  const showToast = useShowToast();
  const copyText = useCopyText();
  const viewingKind = viewing?.kind ?? null;
  const viewingId = viewing?.id ?? null;
  return useMemo<ActionEnv>(
    () => ({
      getState: useAppStore.getState,
      showToast,
      copyText,
      origin,
      anchorKey,
      viewing:
        viewingKind === null || viewingId === null ? null : { kind: viewingKind, id: viewingId },
      isOutcomeShown,
      ...(hasRunSurface === undefined ? {} : { hasRunSurface }),
    }),
    [anchorKey, copyText, hasRunSurface, isOutcomeShown, origin, showToast, viewingId, viewingKind],
  );
};
