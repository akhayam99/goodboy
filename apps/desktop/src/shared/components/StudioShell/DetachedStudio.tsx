import { cn, Divider, OverlayHeader, PageColumn } from '@goodboy/ui';
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
          ? 'relative h-full w-full flex flex-col bg-background'
          : variant === 'viewport'
            ? 'fixed inset-0 z-studio flex flex-col bg-background'
            : 'relative flex h-full w-full min-h-0 flex-col bg-background',
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
          <Divider />
        </>
      )}

      <div className="flex min-h-0 flex-1">{children(requestClose)}</div>
    </div>
  );
};
