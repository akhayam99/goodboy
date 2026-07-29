import { cn } from '@goodboy/ui';
import { levelTone } from '../levelTone';

type Props = {
  readonly level: string | null;
};

export const SentryLevelBadge = ({ level }: Props) => {
  return (
    <span
      className={cn(
        'shrink-0 rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
        levelTone({ level }),
      )}
    >
      {level ?? 'error'}
    </span>
  );
};
