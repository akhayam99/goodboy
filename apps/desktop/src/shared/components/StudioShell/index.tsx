import type { ReactNode } from 'react';
import { cn, SHEET_CLASSES, type Tone } from '@goodboy/ui';
import type { LucideIcon } from 'lucide-react';
import { useStudioOverlay } from '../../hooks/useStudioOverlay';
import { OverlayHeader } from '@goodboy/ui';

type Props = {
  readonly icon?: LucideIcon;
  readonly tone?: Tone;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly closeLabel: string;
  readonly headerAccessory?: ReactNode;
  readonly onClose: () => void;
  readonly isEscapeEnabled?: boolean;
  readonly variant?: 'fullscreen' | 'slot' | 'viewport';
  readonly children: (requestClose: () => void) => ReactNode;
};

export const StudioShell = ({
  icon: Icon,
  tone,
  glyph,
  title,
  subtitle,
  closeLabel,
  headerAccessory,
  onClose,
  isEscapeEnabled = true,
  variant = 'fullscreen',
  children,
}: Props) => {
  const { closing, requestClose } = useStudioOverlay({ onClose, isEscapeEnabled });

  return (
    <div
      {...(variant === 'slot' ? {} : { 'data-studio-overlay': '' })}
      className={cn(
        variant === 'slot'
          ? 'relative h-full w-full flex flex-col bg-chrome'
          : variant === 'viewport'
            ? 'fixed inset-0 z-studio flex flex-col bg-chrome'
            : 'relative flex h-full w-full min-h-0 flex-col bg-chrome',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      <OverlayHeader
        {...(variant === 'slot' && { heightClassName: 'h-7.5' })}
        icon={Icon}
        {...(tone != null && { tone })}
        glyph={glyph}
        title={title}
        {...(subtitle !== undefined && { subtitle })}
        onClose={requestClose}
        closeLabel={closeLabel}
        variant={variant === 'slot' ? 'compact' : 'fullscreen'}
      >
        {headerAccessory}
      </OverlayHeader>
      <div
        className={cn(
          'flex min-h-0 flex-1 bg-background',
          SHEET_CLASSES.flush,
          'has-[[data-studio-rail]]:border-y-0',
        )}
      >
        {children(requestClose)}
      </div>
    </div>
  );
};
