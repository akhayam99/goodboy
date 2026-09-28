import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, IconButton } from '@goodboy/ui';

export type QuestionPagerModel = {
  readonly index: number;
  readonly doneFlags: ReadonlyArray<boolean>;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
};

type Props = {
  readonly pager: QuestionPagerModel;
};

const dotClass = ({
  isCurrent,
  isDone,
}: {
  readonly isCurrent: boolean;
  readonly isDone: boolean;
}) => {
  if (isCurrent) {
    return 'bg-foreground';
  }
  if (isDone) {
    return 'bg-success';
  }
  return 'bg-idle';
};

export const QuestionPager = ({ pager }: Props) => {
  const total = pager.doneFlags.length;

  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-label tabular-nums text-muted-foreground">
        {pager.index + 1} of {total}
      </span>
      <span aria-hidden className="flex items-center gap-1">
        {pager.doneFlags.map((isDone, position) => (
          <span
            key={position}
            className={cn(
              'size-1.5 rounded-full',
              dotClass({ isCurrent: position === pager.index, isDone }),
            )}
          />
        ))}
      </span>
      <span className="flex items-center">
        <IconButton
          icon={ChevronLeft}
          label="Previous question"
          variant="ghost"
          iconSize={14}
          disabled={pager.index === 0}
          onClick={pager.onPrevious}
        />
        <IconButton
          icon={ChevronRight}
          label="Next question"
          variant="ghost"
          iconSize={14}
          disabled={pager.index >= total - 1}
          onClick={pager.onNext}
        />
      </span>
    </span>
  );
};
