import { useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';

type Props = {
  readonly reads: ReadonlyArray<string>;
};

export const ChatReads = ({ reads }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (reads.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="-ml-1 flex items-center gap-1 rounded-sm px-1 text-chip text-faint-foreground motion-safe:transition-colors hover:bg-hover hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <BookOpen size={ICON_SIZE.row} aria-hidden />
        {`Read ${pluralize(reads.length, 'file')}`}
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn('motion-safe:transition-transform', isOpen && 'rotate-90')}
        />
      </button>
      {isOpen ? (
        <ul
          aria-label="Files read"
          className="flex w-full flex-col rounded-lg bg-subtle px-3 py-2 text-code text-faint-foreground"
        >
          {reads.map((path) => (
            <li key={path} className="truncate">
              {path}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
