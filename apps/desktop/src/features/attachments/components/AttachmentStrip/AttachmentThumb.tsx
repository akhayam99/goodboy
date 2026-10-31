import type { MouseEvent } from 'react';
import { ImageOff, X } from 'lucide-react';
import { Button, ICON_SIZE, IconButton, Skeleton, Tooltip } from '@goodboy/ui';
import type { AttachmentThumbnail } from '../AttachmentChip';

type Props = {
  readonly fileName: string;
  readonly thumbnail: AttachmentThumbnail;
  readonly title: string;
  readonly onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onRemove?: () => void;
};

const FRAME =
  'group relative h-12 w-12 shrink-0 overflow-hidden rounded-md ring-1 ring-border-soft';

export const AttachmentThumb = ({ fileName, thumbnail, title, onOpen, onRemove }: Props) => {
  const removeButton =
    onRemove == null ? null : (
      <IconButton
        icon={X}
        label={`Remove ${fileName}`}
        iconSize={ICON_SIZE.mark}
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 h-4 w-4 rounded-sm border-0 bg-foreground p-0 text-background hover:bg-foreground hover:text-background"
      />
    );

  if (thumbnail.status === 'failed') {
    return (
      <Tooltip content={title}>
        <div className={FRAME}>
          <div
            role="img"
            aria-label={`${fileName}, not available`}
            className="flex h-full w-full items-center justify-center bg-subtle text-muted-foreground"
          >
            <ImageOff size={ICON_SIZE.control} aria-hidden />
          </div>
          {removeButton}
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={title}>
      <div className={FRAME}>
        <Button
          variant="ghost"
          onClick={onOpen}
          aria-label={`Preview ${fileName}`}
          className="h-full w-full cursor-zoom-in rounded-none p-0"
        >
          {thumbnail.status === 'ready' ? (
            <img src={thumbnail.src} alt="" className="h-full w-full object-cover" />
          ) : (
            <Skeleton className="h-full w-full rounded-none" />
          )}
        </Button>
        {removeButton}
      </div>
    </Tooltip>
  );
};
