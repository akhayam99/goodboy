import { Paperclip } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly isDragging: boolean;
};

export const PromptDropOverlay = ({ isDragging }: Props) => (
  <div
    className={cn(
      'pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed transition-opacity duration-150',
      tintClasses('primary').bgSoft,
      tintClasses('primary').border,
      isDragging ? 'opacity-100' : 'opacity-0',
    )}
    aria-hidden
    data-state={isDragging ? 'dragging' : 'idle'}
  >
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border border-border-soft bg-background px-4 py-1 text-label font-medium text-primary ring-1 transition-transform duration-150',
        tintClasses('primary').ring,
        isDragging ? 'scale-100' : 'scale-95',
      )}
    >
      <Paperclip size={ICON_SIZE.control} aria-hidden />
      Drop to attach · up to 10 files, 10 MB each
    </div>
  </div>
);
