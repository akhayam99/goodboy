import type { MouseEvent } from 'react';
import { ImageOff, X } from 'lucide-react';
import { Button, ICON_SIZE, IconButton, Skeleton, Tooltip } from '@goodboy/ui';
import type { AttachmentThumbnail } from '../components/AttachmentChip';

type Props = {
  readonly id: string;
  readonly fileName: string;
  readonly thumbnail: AttachmentThumbnail;
  readonly title: string;
  readonly onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onRemove?: () => void;
};

const FRAME =
  'group relative h-12 w-12 shrink-0 overflow-hidden rounded-md ring-1 ring-border-soft';

export const AttachmentThumb = ({ id, fileName, thumbnail, title, onOpen, onRemove }: Props) => {
  const isFailed = thumbnail.status === 'failed';
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

  return (
    <Tooltip content={title}>
      <div className={FRAME}>
        <Button
          variant="ghost"
          onClick={onOpen}
          data-attachment-control={id}
          aria-label={isFailed ? `${fileName}, not available` : `Preview ${fileName}`}
          className="h-full w-full cursor-zoom-in rounded-none p-0"
        >
          {thumbnail.status === 'ready' ? (
            <img src={thumbnail.src} alt="" className="h-full w-full object-cover" />
          ) : isFailed ? (
            <span className="flex h-full w-full items-center justify-center bg-subtle text-muted-foreground">
              <ImageOff size={ICON_SIZE.control} aria-hidden />
            </span>
          ) : (
            <Skeleton className="h-full w-full rounded-none" />
          )}
        </Button>
        {removeButton}
      </div>
    </Tooltip>
  );
};
