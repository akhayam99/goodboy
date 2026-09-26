import { cn, OverlayHeader, PageColumn, SHEET_CLASSES } from '@goodboy/ui';
import { useStudioOverlay } from '../../hooks/useStudioOverlay';
import type { StudioShellProps } from './types';

export const DetachedStudio = ({
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
}: StudioShellProps) => {
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
        variant !== 'slot' &&
          (closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in'),
      )}
    >
      {variant === 'slot' ? (
        headerAccessory != null ? (
          <PageColumn className="flex shrink-0 items-center justify-end pb-2">
            {headerAccessory}
          </PageColumn>
        ) : null
      ) : (
        <>
          <OverlayHeader
            icon={Icon}
            {...(tone != null && { tone })}
            glyph={glyph}
            title={title}
            {...(subtitle !== undefined && { subtitle })}
            onClose={requestClose}
            closeLabel={closeLabel}
            variant="fullscreen"
          >
            {headerAccessory}
          </OverlayHeader>
        </>
      )}

      <div
        className={cn(
          'flex min-h-0 flex-1 bg-background',
          variant !== 'slot' && SHEET_CLASSES.flush,
          variant !== 'slot' && 'has-[[data-studio-rail]]:border-y-0',
        )}
      >
        {children(requestClose)}
      </div>
    </div>
  );
};
