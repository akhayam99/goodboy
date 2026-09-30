import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { REWRITE_STAGES } from '../../reviewCommitsCopy';
import type { ReviewCommitsModel } from './useReviewCommits';

type Props = {
  readonly model: ReviewCommitsModel;
};

export const ReviewCommitsProgress = ({ model }: Props) => {
  const stages = model.replaced > 0 ? REWRITE_STAGES : REWRITE_STAGES.slice(0, 3);
  return (
    <ol
      aria-label="Rewrite progress"
      className="flex flex-wrap items-center gap-2 text-label text-faint-foreground"
    >
      {stages.map((label, index) => (
        <li
          key={label}
          className={cn(
            'inline-flex list-none items-center gap-1.5',
            index < model.stage && 'text-muted-foreground',
            index === model.stage && 'text-foreground',
          )}
        >
          {index < model.stage ? (
            <Check size={ICON_SIZE.row} className="text-success" aria-hidden />
          ) : (
            <span
              className={cn(
                'size-2 rounded-full',
                index === model.stage
                  ? 'bg-info motion-safe:animate-soft-pulse'
                  : 'bg-border-strong',
              )}
              aria-hidden
            />
          )}
          {label}
        </li>
      ))}
    </ol>
  );
};
