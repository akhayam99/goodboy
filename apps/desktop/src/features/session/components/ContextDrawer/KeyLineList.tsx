import { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Markdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly items: ReadonlyArray<string>;
  readonly label: string;
};

export const KeyLineList = ({ items, label }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const [first, ...rest] = items;

  if (first === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-body text-foreground [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap">
        <Markdown text={first} />
      </div>
      {rest.length === 0 ? null : (
        <>
          {isOpen ? (
            <ul
              id={listId}
              aria-label={`More in ${label}`}
              className="flex flex-col gap-1 border-l border-border-soft pl-3"
            >
              {rest.map((item, index) => (
                <li
                  key={`${index}-${item}`}
                  className="text-prose text-muted-foreground [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap"
                >
                  <Markdown text={item} />
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={listId}
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 self-start rounded-sm text-secondary text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {isOpen ? (
              <ChevronDown size={ICON_SIZE.row} aria-hidden />
            ) : (
              <ChevronRight size={ICON_SIZE.row} aria-hidden />
            )}
            {isOpen ? 'Show less' : `Show ${rest.length} more`}
          </button>
        </>
      )}
    </div>
  );
};
