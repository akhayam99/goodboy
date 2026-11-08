import { useState } from 'react';
import { Check, ChevronDown, CircleCheck } from 'lucide-react';
import { ICON_SIZE, SelectableRow, cn } from '@goodboy/ui';
import { countNoun } from '../../../../../shared/utils/countNoun';

type Props = {
  readonly passing: ReadonlyArray<string>;
};

export const MergeBoxPassing = ({ passing }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (passing.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col">
      <SelectableRow
        selected={false}
        isExpanded={isOpen}
        testId="merge-passing"
        className="flex min-h-9 w-full min-w-0 items-center gap-3 px-3"
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <CircleCheck size={ICON_SIZE.control} aria-hidden className="shrink-0 text-success" />
        <span className="min-w-0 flex-1 truncate text-meta">
          {isOpen
            ? countNoun({ count: passing.length, one: 'thing passes', many: 'things pass' })
            : passing.join(' · ')}
        </span>
        <ChevronDown
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0 text-faint-foreground motion-safe:transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </SelectableRow>
      {isOpen ? (
        <ul aria-label="What passes" className="flex min-w-0 flex-col">
          {passing.map((pass) => (
            <li
              key={pass}
              className="flex min-h-7 min-w-0 items-center gap-3 px-3 text-meta text-muted-foreground"
            >
              <Check size={ICON_SIZE.control} aria-hidden className="shrink-0 text-success" />
              <span className="min-w-0 truncate">{pass}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
