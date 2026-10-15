import { useState, type ReactNode } from 'react';
import { Disclosure } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly isCollapsible: boolean;
  readonly children: ReactNode;
};

export const DrawerSection = ({ label, isCollapsible, children }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!isCollapsible) {
    return (
      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-row text-foreground">{label}</h3>
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
      </section>
    );
  }
  return (
    <Disclosure
      label={<span className="text-row text-foreground">{label}</span>}
      isOpen={isOpen}
      onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
    >
      <div className="flex min-w-0 flex-col gap-3 py-2">{children}</div>
    </Disclosure>
  );
};
