import { ImagePlus } from 'lucide-react';
import { cn, FileDropZone } from '@goodboy/ui';
import { AttachmentChip } from '../../../attachments/components/AttachmentChip';
import type { BugReportImagesControl } from '../../hooks/useBugReportImages';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly control: BugReportImagesControl;
};

export const BugReportImages = ({ control }: Props) => {
  const {
    images,
    notice,
    dropTargetRef,
    fileInputRef,
    isDragging,
    openPicker,
    onFileInputChange,
    removeImage,
    atLimit,
  } = control;

  return (
    <div className="flex flex-col gap-2">
      <FileDropZone
        ref={dropTargetRef}
        data-drop-composer
        data-testid="bug-report-images"
        actionIcon={<ImagePlus size={ICON_SIZE.row} aria-hidden />}
        actionLabel="Add files or drag"
        isDisabled={atLimit}
        isDragging={isDragging}
        onSelect={openPicker}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onFileInputChange}
          className="hidden"
          aria-hidden
          tabIndex={-1}
        />
        {images.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {images.map((image) => (
              <AttachmentChip
                key={image.id}
                fileName={image.fileName}
                mimeType={image.mimeType}
                thumbnail={{ status: 'ready', src: image.dataUrl }}
                preview={{ src: image.dataUrl }}
                onRemove={() => removeImage(image.id)}
              />
            ))}
          </div>
        ) : null}
      </FileDropZone>
      <p
        className={cn(
          'text-2xs leading-relaxed',
          notice == null ? 'text-muted-foreground' : 'text-warning',
        )}
      >
        {notice ?? 'Paste into the notes, pick, or drag images here. Up to 4, 5MB each.'}
      </p>
    </div>
  );
};
