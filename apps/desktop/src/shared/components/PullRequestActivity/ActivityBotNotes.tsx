import { useState } from 'react';
import { Button, ClampedProse } from '@goodboy/ui';

type Props = {
  readonly notes: ReadonlyArray<string>;
};

export const ActivityBotNotes = ({ notes }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (notes.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Button
        size="xs"
        variant="quiet"
        aria-expanded={isOpen}
        className="w-fit"
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        {isOpen ? 'Hide summary' : 'Show summary'}
      </Button>
      {isOpen ? (
        <ul className="flex min-w-0 flex-col gap-2">
          {notes.map((note, position) => (
            <li
              key={`${position}:${note.length}`}
              className="min-w-0 rounded-md bg-subtle px-3 py-2 text-meta text-foreground"
            >
              <ClampedProse text={note} lines={4} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
