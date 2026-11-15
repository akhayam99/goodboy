import { Chip } from '@goodboy/ui';
import type { QuestionFilterChip } from '../questionsFilterModel';

type PickParams = {
  readonly id: string;
};

type Props = {
  readonly chips: ReadonlyArray<QuestionFilterChip>;
  readonly activeId: string;
  readonly onPick: (params: PickParams) => void;
};

export const QuestionsFilterBar = ({ chips, activeId, onPick }: Props) => (
  <div role="toolbar" aria-label="Filter open questions" className="flex min-w-0 flex-wrap gap-2">
    {chips.map((chip) => {
      const isActive = chip.id === activeId;
      return (
        <Chip
          key={chip.id}
          as="button"
          testId={`questions-filter-${chip.id}`}
          tone="neutral"
          emphasis="subtle"
          ariaPressed={isActive}
          label={chip.label}
          trailing={<span className="tabular-nums text-faint-foreground">{chip.count}</span>}
          className={isActive ? 'bg-selected text-foreground' : undefined}
          onClick={() => onPick({ id: chip.id })}
        />
      );
    })}
  </div>
);
