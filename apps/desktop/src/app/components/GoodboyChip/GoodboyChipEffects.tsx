import type { RefObject } from 'react';
import { UpdateArrivalCard } from '../../../features/updater/components/UpdateArrivalCard';
import { useRestartWhenIdle } from '../../../features/updater/hooks/useRestartWhenIdle';

type Props = {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onOpenChangelog: () => void;
  readonly isBesideAnchor?: boolean;
};

export const GoodboyChipEffects = ({
  anchorRef,
  onOpenChangelog,
  isBesideAnchor = false,
}: Props) => {
  useRestartWhenIdle();
  return (
    <UpdateArrivalCard
      anchorRef={anchorRef}
      onOpenChangelog={onOpenChangelog}
      isBesideAnchor={isBesideAnchor}
    />
  );
};
