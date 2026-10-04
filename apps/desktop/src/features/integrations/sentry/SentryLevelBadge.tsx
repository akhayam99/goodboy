import { cn } from '@goodboy/ui';
import { levelTone } from './levelTone';

type Props = {
  readonly level: string | null;
  readonly density?: 'default' | 'compact';
};

export const SentryLevelBadge = ({ level, density = 'default' }: Props) => {
  return (
    <span
      className={cn(
        'shrink-0 rounded-sm border font-semibold uppercase tracking-eyebrow',
        density === 'compact' ? 'px-1 py-px text-chip leading-none' : 'px-2 py-0.5 text-meta',
        levelTone({ level }),
      )}
    >
      {level ?? 'error'}
    </span>
  );
};
