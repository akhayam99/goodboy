import { useState } from 'react';
import { Disclosure, Markdown } from '@goodboy/ui';
import type { NotesRole } from './readingOrderOf';

type Props = {
  role: NotesRole;
};

export const ReadingNotes = ({ role }: Props) => {
  const [isOpen, setIsOpen] = useState(role.isOpen);
  return (
    <Disclosure
      label={
        <span className="text-meta text-muted-foreground">{`Notes, ${role.lineCount} ${
          role.lineCount === 1 ? 'line' : 'lines'
        }`}</span>
      }
      isOpen={isOpen}
      onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
      testId="reading-notes"
    >
      <div className="flex min-w-0 flex-col gap-2 text-prose text-muted-foreground">
        {role.notes.map((note) => (
          <Markdown key={note.key} text={note.text} />
        ))}
      </div>
    </Disclosure>
  );
};
