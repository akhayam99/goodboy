import { useState, type ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import { READING_BUDGETS } from '../../chat/readingOrder/readingBudgets';

type Props = {
  readonly chips: ReadonlyArray<ReactNode>;
};

export const DelegationResultChips = ({ chips }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (chips.length === 0) {
    return null;
  }
  const shown = isExpanded ? chips : chips.slice(0, READING_BUDGETS.maxChips);
  const hiddenCount = chips.length - shown.length;
  return (
    <div data-testid="reading-chips" className="flex min-w-0 flex-wrap items-center gap-2">
      {shown}
      {hiddenCount > 0 ? (
        <Button variant="quiet" size="xs" onClick={() => setIsExpanded(true)}>
          {`+${hiddenCount}`}
        </Button>
      ) : null}
    </div>
  );
};
