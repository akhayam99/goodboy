import { useState, type MouseEvent } from 'react';
import { cn } from '@goodboy/ui';
import { ImageLightbox } from '../../../../shared/components/ImageLightbox';
import type { ImageLightboxItem } from '../../../../shared/components/ImageLightbox/types';
import { readAttachment } from '../../../chat/turn';
import { useAttachmentThumbnails, type ThumbnailSource } from '../../hooks/useAttachmentThumbnails';
import { AttachmentChip, type AttachmentThumbnail } from '../AttachmentChip';
import { AttachmentMoreTile } from './AttachmentMoreTile';
import { AttachmentThumb } from './AttachmentThumb';
import { splitStripImages } from './stripLayout';

export type AttachmentStripItem = {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly kind: 'image' | 'file';
  readonly relPath: string;
  readonly workingDir: string | null;
  readonly title?: string;
  readonly onRemove?: () => void;
};

type Props = {
  readonly items: ReadonlyArray<AttachmentStripItem>;
  readonly railLabel: string;
  readonly isEnd?: boolean;
};

type IdParams = {
  readonly id: string;
};

const LOADING: AttachmentThumbnail = { status: 'loading' };

export const AttachmentStrip = ({ items, railLabel, isEnd = false }: Props) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const images = items.filter((item) => item.kind === 'image');
  const files = items.filter((item) => item.kind !== 'image');
  const { shown, hidden } = splitStripImages({ count: images.length });
  const loaded: ReadonlyArray<AttachmentStripItem> =
    openId === null ? images.slice(0, shown) : images;
  const sources: ReadonlyArray<ThumbnailSource> = loaded.map(({ id, relPath, workingDir }) => ({
    id,
    relPath,
    workingDir,
  }));
  const thumbnails = useAttachmentThumbnails({ sources });

  const thumbnailOf = ({ id }: IdParams): AttachmentThumbnail => thumbnails[id] ?? LOADING;

  const openAt =
    ({ id }: IdParams) =>
    (event: MouseEvent<HTMLButtonElement>) => {
      event.currentTarget.focus();
      setOpenId(id);
    };

  const lightboxItems: ReadonlyArray<ImageLightboxItem> = images.map((item) => ({
    id: item.id,
    alt: item.fileName,
    source: thumbnailOf({ id: item.id }),
  }));
  const firstHidden = images[shown];

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', isEnd && 'items-end')}>
      {images.length > 0 && (
        <div className={cn('flex gap-2', isEnd && 'justify-end')}>
          {images.slice(0, shown).map((item) => (
            <AttachmentThumb
              key={item.id}
              fileName={item.fileName}
              thumbnail={thumbnailOf({ id: item.id })}
              title={item.title ?? item.fileName}
              onOpen={openAt({ id: item.id })}
              {...(item.onRemove === undefined ? {} : { onRemove: item.onRemove })}
            />
          ))}
          {hidden > 0 && firstHidden !== undefined && (
            <AttachmentMoreTile hidden={hidden} onOpen={openAt({ id: firstHidden.id })} />
          )}
        </div>
      )}
      {files.length > 0 && (
        <div className={cn('flex flex-wrap gap-2', isEnd && 'justify-end')}>
          {files.map((item) => (
            <AttachmentChip
              key={item.id}
              fileName={item.fileName}
              mimeType={item.mimeType}
              title={item.title ?? item.fileName}
              lazyPreview={
                item.mimeType === 'application/pdf' && item.workingDir !== null
                  ? {
                      load: () => readAttachment(item.workingDir ?? '', item.relPath),
                      media: 'pdf',
                    }
                  : undefined
              }
              {...(item.onRemove === undefined ? {} : { onRemove: item.onRemove })}
            />
          ))}
        </div>
      )}
      {openId !== null && (
        <ImageLightbox
          items={lightboxItems}
          startId={openId}
          railLabel={railLabel}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
};
