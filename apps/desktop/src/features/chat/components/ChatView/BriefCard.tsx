import { useState } from 'react';
import { Disclosure } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly text: string;
};

export const BriefCard = ({ label, text }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Disclosure
      testId="chat-brief-card"
      label={<span className="min-w-0 truncate text-body text-muted-foreground">{label}</span>}
      isOpen={isOpen}
      onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
      className="rounded-md border border-border-soft"
    >
      <p className="whitespace-pre-wrap break-words pb-2 text-body text-muted-foreground">{text}</p>
    </Disclosure>
  );
};
