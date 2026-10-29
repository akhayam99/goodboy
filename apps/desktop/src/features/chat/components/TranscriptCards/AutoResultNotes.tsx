import { useState } from 'react';
import { ClampedProse, Disclosure } from '@goodboy/ui';

type Props = {
  readonly text: string;
};

export const AutoResultNotes = ({ text }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Disclosure
      label={
        <span className="text-meta text-muted-foreground">
          {isOpen ? "Hide the agent's notes" : "Show the agent's notes"}
        </span>
      }
      isOpen={isOpen}
      onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
      testId="auto-result-notes"
    >
      <ClampedProse text={text} lines={6} />
    </Disclosure>
  );
};
