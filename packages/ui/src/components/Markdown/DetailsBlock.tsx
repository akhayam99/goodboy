import { useState, type ReactNode } from 'react';
import { Disclosure } from '../Disclosure';

type Props = {
  readonly label: ReactNode;
  readonly isOpenAtStart: boolean;
  readonly children: ReactNode;
};

export const DetailsBlock = ({ label, isOpenAtStart, children }: Props) => {
  const [isOpen, setIsOpen] = useState(isOpenAtStart);
  return (
    <Disclosure
      label={label}
      isOpen={isOpen}
      onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
      testId="markdown-details"
      triggerClassName="w-fit max-w-full text-body text-foreground"
    >
      <div className="flex flex-col gap-2 text-prose text-foreground wrap-anywhere">{children}</div>
    </Disclosure>
  );
};
