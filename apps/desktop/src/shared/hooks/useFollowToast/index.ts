import { useCallback } from 'react';
import { useAppStore } from '../../../store';
import type { OpenDrawer } from '../../../store/slices/drawer/state';
import type { PlaceRequest } from '../../../store/slices/navigation/types';
import { useToast } from '../../components/Toast';
import type { ShowToast } from '../../components/Toast/toastContext';
import { useShowToast } from '../../components/Toast/useShowToast';
import { FOLLOW_LABEL, followDedupeKey } from '../../lib/followToast';
import { markUserStart } from '../../lib/userStarts';
import { isTargetShown } from './isTargetShown';

type FollowTarget = {
  readonly place: PlaceRequest;
  readonly drawer?: OpenDrawer;
};

type FollowParams = {
  readonly title: string;
  readonly message?: string;
  readonly target: FollowTarget;
  readonly label?: string;
  readonly startKey?: string;
  readonly onFollow?: () => void;
};

const OVERLAY_DRAWER_SELECTOR = 'aside[data-drawer-mode="overlay"]';

export const isOverlayDrawerOpen = (): boolean =>
  typeof document !== 'undefined' && document.querySelector(OVERLAY_DRAWER_SELECTOR) !== null;

const useFollowOn = ({
  showToast,
}: {
  readonly showToast: ShowToast;
}): ((params: FollowParams) => void) => {
  const navigate = useAppStore((state) => state.navigate);
  return useCallback(
    ({ title, message = '', target, label = FOLLOW_LABEL, startKey, onFollow }: FollowParams) => {
      if (startKey !== undefined) {
        markUserStart({ key: startKey });
      }
      const drawer = target.drawer ?? null;
      const isShown = isTargetShown({
        state: useAppStore.getState(),
        request: target.place,
        drawer,
        isOverlayOpen: isOverlayDrawerOpen(),
      });
      showToast({
        kind: 'info',
        title,
        message,
        ...(startKey !== undefined && { dedupeKey: followDedupeKey({ startKey }) }),
        ...(!isShown && {
          action: {
            label,
            onClick: () => {
              navigate({ to: target.place, ...(drawer !== null && { drawer }) });
              onFollow?.();
            },
          },
        }),
      });
    },
    [navigate, showToast],
  );
};

export const useFollowToast = (): ((params: FollowParams) => void) =>
  useFollowOn({ showToast: useToast().showToast });

export const useQuietFollowToast = (): ((params: FollowParams) => void) =>
  useFollowOn({ showToast: useShowToast() });
