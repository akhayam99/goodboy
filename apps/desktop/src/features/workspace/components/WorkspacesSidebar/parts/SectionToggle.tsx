import { ChevronDown, ChevronRight } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly expanded: boolean;
  readonly label: string;
  readonly onToggle: () => void;
};

export const SectionToggle = ({ expanded, label, onToggle }: Props) => {
  return (
    <Tooltip content={`${expanded ? 'Collapse' : 'Expand'} ${label}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'collapse' : 'expand'} ${label}`}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown size={ICON_SIZE.row} aria-hidden />
        ) : (
          <ChevronRight size={ICON_SIZE.row} aria-hidden />
        )}
      </button>
    </Tooltip>
  );
};
