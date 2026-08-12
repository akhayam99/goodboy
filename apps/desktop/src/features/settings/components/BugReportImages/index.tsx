import { ImagePlus } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { AttachmentChip } from '../../../attachments/components/AttachmentChip';
import type { BugReportImagesControl } from '../../hooks/useBugReportImages';

type Props = {
  readonly control: BugReportImagesControl;
};

export const BugReportImages = ({ control }: Props) => {
  const { images, notice, fileInputRef, openPicker, onFileInputChange, removeImage, atLimit } =
    control;

  return (
    <div data-testid="bug-report-images" className="flex flex-col gap-2">
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
        <button
          type="button"
          onClick={openPicker}
          disabled={atLimit}
          className={cn(
            'inline-flex h-16 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground motion-safe:transition-colors',
            atLimit
              ? 'cursor-not-allowed opacity-50'
              : 'hover:border-border-strong hover:text-foreground',
          )}
        >
          <ImagePlus size={13} aria-hidden />
          Add image
        </button>
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
      </div>
      <p
        className={cn(
          'text-2xs leading-relaxed',
          notice == null ? 'text-muted-foreground' : 'text-warning',
        )}
      >
        {notice ?? 'Paste a screenshot straight into the notes, or pick a file. Up to 4, 5MB each.'}
      </p>
    </div>
  );
};
