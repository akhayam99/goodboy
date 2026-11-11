import type { ReactNode } from 'react';
import { Button, ListGridGroup } from '@goodboy/ui';

type Props = {
  readonly count: number;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
};

export const FinishedBranches = ({ count, isOpen, onToggle, children }: Props) => {
  if (count === 0) {
    return null;
  }
  return (
    <ListGridGroup
      headingLevel={2}
      label="Finished"
      count={count}
      action={
        <Button variant="quiet" size="xs" aria-expanded={isOpen} onClick={onToggle}>
          {isOpen ? 'Hide' : 'Show'}
        </Button>
      }
    >
      {isOpen ? children : null}
    </ListGridGroup>
  );
};
