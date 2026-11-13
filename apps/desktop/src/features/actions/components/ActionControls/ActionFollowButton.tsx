import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { Place } from '../../../../store/slices/navigation/types';
import { isOverlayDrawerOpen } from '../../../../shared/hooks/useFollowToast';
import { isTargetShown } from '../../../../shared/hooks/useFollowToast/isTargetShown';
import { FOLLOW_LABEL } from '../../../../shared/lib/followToast';

type Props = {
  readonly place: Place;
};

export const ActionFollowButton = ({ place }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const isShown = useAppStore((state) =>
    isTargetShown({ state, request: place, drawer: null, isOverlayOpen: isOverlayDrawerOpen() }),
  );
  if (isShown) {
    return null;
  }
  return (
    <Button size="sm" variant="ghost" onClick={() => navigate({ to: place })}>
      {FOLLOW_LABEL}
    </Button>
  );
};
