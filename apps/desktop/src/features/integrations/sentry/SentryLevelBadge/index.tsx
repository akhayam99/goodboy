import { cn } from '@goodboy/ui';
import { levelTone } from '../levelTone';

type Props = {
  readonly level: string | null;
  readonly density?: 'default' | 'compact';
};

export const SentryLevelBadge = ({ level, density = 'default' }: Props) => {
  return (
    <span
      className={cn(
        'shrink-0 rounded border font-semibold uppercase tracking-wide',
        density === 'compact' ? 'px-1 py-px text-3xs leading-none' : 'px-1.5 py-0.5 text-2xs',
        levelTone({ level }),
      )}
    >
      {level ?? 'error'}
    </span>
  );
};
