import { ChevronDown } from 'lucide-react';
import { ROW_INTERACTIVE, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

const CHEVRON =
  'flex size-4 shrink-0 items-center justify-center rounded-sm text-faint-foreground hover:text-foreground';

type Props = {
  readonly title: string;
  readonly isFolded: boolean;
  readonly onToggle: () => void;
};

export const PagesChevron = ({ title, isFolded, onToggle }: Props) => {
  const label = isFolded ? `Show the pages of ${title}` : `Fold the pages of ${title}`;
  return (
    <Tooltip content={label} side="right">
      <button
        type="button"
        data-slot="pages-chevron"
        aria-expanded={!isFolded}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          CHEVRON,
          ROW_INTERACTIVE,
          isFolded
            ? 'opacity-100'
            : 'opacity-0 focus-visible:opacity-100 group-focus-within/select-row:opacity-100 group-hover/select-row:opacity-100',
        )}
      >
        <ChevronDown
          size={ICON_SIZE.row}
          aria-hidden
          className={cn('motion-safe:transition-transform', isFolded && '-rotate-90')}
        />
      </button>
    </Tooltip>
  );
};
