import { ArrowDown } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';

type Props = {
  readonly count: number;
  readonly onShowNext: () => void;
};

export const NeedsYouCount = ({ count, onShowNext }: Props) => {
  const isOne = count === 1;
  return (
    <button
      type="button"
      data-needs-you-count={count}
      aria-label={`${count} ${isOne ? 'thing waits' : 'things wait'} on you, go to Next`}
      onClick={onShowNext}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-label text-warning',
        ROW_INTERACTIVE,
      )}
    >
      <span className="tabular-nums">{`${count} ${isOne ? 'waits' : 'wait'} on you`}</span>
      <ArrowDown size={ICON_SIZE.row} aria-hidden />
    </button>
  );
};
