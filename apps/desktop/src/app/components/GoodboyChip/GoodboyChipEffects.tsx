import { UpdateArrivalCard } from '../../../features/updater/components/UpdateArrivalCard';
import { useRestartWhenIdle } from '../../../features/updater/hooks/useRestartWhenIdle';

type Props = {
  readonly onOpenChangelog: () => void;
};

export const GoodboyChipEffects = ({ onOpenChangelog }: Props) => {
  useRestartWhenIdle();
  return <UpdateArrivalCard onOpenChangelog={onOpenChangelog} />;
};
