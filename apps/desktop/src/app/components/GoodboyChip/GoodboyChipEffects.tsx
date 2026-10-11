import type { RefObject } from 'react';
import { UpdateArrivalCard } from '../../../features/updater/components/UpdateArrivalCard';
import { useRestartWhenIdle } from '../../../features/updater/hooks/useRestartWhenIdle';

type Props = {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onOpenChangelog: () => void;
};

export const GoodboyChipEffects = ({ anchorRef, onOpenChangelog }: Props) => {
  useRestartWhenIdle();
  return <UpdateArrivalCard anchorRef={anchorRef} onOpenChangelog={onOpenChangelog} />;
};
