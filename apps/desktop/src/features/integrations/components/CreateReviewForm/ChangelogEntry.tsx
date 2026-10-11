import { useState } from 'react';
import { Button, CopyButton } from '@goodboy/ui';
import { PropertyBlock } from '../../../../shared/components/PropertyBlock';

type Props = {
  readonly entry: string;
};

export const ChangelogEntry = ({ entry }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
        onClick={() => setIsOpen(true)}
      >
        More options
      </Button>
    );
  }
  return (
    <PropertyBlock label="Changelog entry" action={<CopyButton value={entry} label="Copy entry" />}>
      <pre className="w-full whitespace-pre-wrap rounded-md bg-subtle px-2 py-1 text-code text-foreground">
        {entry}
      </pre>
    </PropertyBlock>
  );
};
