import { useId, useState } from 'react';
import { Markdown } from '@goodboy/ui';
import { ContextExpander } from './ContextExpander';

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
    <div className="flex flex-col gap-2">
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
          <ContextExpander
            label={isOpen ? 'Show less' : `Show ${rest.length} more`}
            isOpen={isOpen}
            controlsId={listId}
            onToggle={() => setIsOpen(!isOpen)}
          />
        </>
      )}
    </div>
  );
};
