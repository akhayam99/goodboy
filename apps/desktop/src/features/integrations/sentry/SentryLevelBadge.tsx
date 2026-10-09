import { cn, Eyebrow } from '@goodboy/ui';
import { levelTone } from './levelTone';

type Props = {
  readonly level: string | null;
  readonly density?: 'default' | 'compact';
};

export const SentryLevelBadge = ({ level, density = 'default' }: Props) => {
  return (
    <Eyebrow
      label={level ?? 'error'}
      className={cn(
        'shrink-0 rounded-sm border',
        density === 'compact' ? 'px-1 py-px leading-none' : 'px-2 py-0.5',
        levelTone({ level }),
      )}
    />
  );
};
