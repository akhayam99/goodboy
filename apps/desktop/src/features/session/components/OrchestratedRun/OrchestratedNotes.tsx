import { useState } from 'react';
import { Disclosure } from '@goodboy/ui';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';

type Props = {
  readonly notes: ReadonlyArray<string>;
};

export const OrchestratedNotes = ({ notes }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (notes.length === 0) {
    return null;
  }
  return (
    <Disclosure
      label={
        <span className="text-ui text-muted-foreground">
          {ORCHESTRATED_COPY.leftOpen({ count: notes.length })}
        </span>
      }
      isOpen={isOpen}
      onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
      className="self-start"
    >
      <ul data-orchestrated-notes="" className="flex min-w-0 flex-col gap-1 px-2">
        {notes.map((note) => (
          <li key={note} className="min-w-0 text-ui text-muted-foreground">
            {note}
          </li>
        ))}
      </ul>
    </Disclosure>
  );
};
