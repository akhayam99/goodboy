import { ChevronDown, ChevronRight } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';

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
        {expanded ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
      </button>
    </Tooltip>
  );
};
