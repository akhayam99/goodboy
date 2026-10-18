import type { BootPhase } from '../../../store/slices/boot/state';
import { bootProgressPercent } from './bootProgressPercent';

type Props = {
  readonly phase: BootPhase;
};

export const BootProgress = ({ phase }: Props) => {
  const percent = bootProgressPercent({ phase });
  return (
    <div
      role="progressbar"
      aria-label="Starting Goodboy"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className="h-0.5 w-40 overflow-hidden rounded-full bg-fill"
    >
      <div
        data-testid="boot-progress-fill"
        className="h-full rounded-full bg-foreground motion-safe:transition-[width] motion-safe:duration-200"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};
