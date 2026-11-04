import type { MouseEvent } from 'react';
import { Button, cn } from '@goodboy/ui';
import type { StripSize } from './stripLayout';

type Props = {
  readonly id: string;
  readonly hidden: number;
  readonly onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly size?: StripSize;
};

export const AttachmentMoreTile = ({ id, hidden, onOpen, size = 'default' }: Props) => (
  <Button
    variant="quiet"
    size={size === 'compact' ? 'xs' : 'md'}
    onClick={onOpen}
    data-attachment-control={id}
    aria-label={`Show ${hidden} more ${hidden === 1 ? 'image' : 'images'}`}
    className={cn(
      'shrink-0 cursor-zoom-in bg-subtle p-0 tabular-nums ring-1 ring-border-soft',
      size === 'compact' ? 'w-6' : 'h-12 w-12',
    )}
  >
    +{hidden}
  </Button>
);
