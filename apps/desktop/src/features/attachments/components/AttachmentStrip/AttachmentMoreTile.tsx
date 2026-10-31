import type { MouseEvent } from 'react';
import { Button } from '@goodboy/ui';

type Props = {
  readonly hidden: number;
  readonly onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
};

export const AttachmentMoreTile = ({ hidden, onOpen }: Props) => (
  <Button
    variant="quiet"
    onClick={onOpen}
    aria-label={`Show ${hidden} more ${hidden === 1 ? 'image' : 'images'}`}
    className="h-12 w-12 shrink-0 cursor-zoom-in bg-subtle p-0 tabular-nums ring-1 ring-border-soft"
  >
    +{hidden}
  </Button>
);
