import { cn, PageColumn, PaneActionsContext, SHEET_CLASSES } from '@goodboy/ui';
import { useStudioOverlay } from '../../hooks/useStudioOverlay';
import { closeLabelOf } from './closeLabelOf';
import { HeaderCloseButton } from './HeaderCloseButton';
import { StudioCloseButton } from './StudioCloseButton';
import { useHeaderCloseClaim } from './useHeaderCloseClaim';
import type { StudioShellProps } from './types';

export const DetachedStudio = ({
  title,
  closeLabel,
  headerAccessory,
  onClose,
  isEscapeEnabled = true,
  variant = 'fullscreen',
  children,
}: StudioShellProps) => {
  const { closing, requestClose } = useStudioOverlay({ onClose, isEscapeEnabled });
  const headerCloseClaim = useHeaderCloseClaim();
  const label = closeLabelOf({ title, closeLabel });
  const isSlot = variant === 'slot';
  const hasAccessory = headerAccessory !== undefined && headerAccessory !== null;
  const isBandClose = !isSlot && !headerCloseClaim.isClaimed;

  return (
    <div
      {...(isSlot ? {} : { 'data-studio-overlay': '' })}
      className={cn(
        isSlot
          ? 'relative h-full w-full flex flex-col bg-chrome'
          : 'relative flex h-full w-full min-h-0 flex-col bg-chrome',
        !isSlot && (closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in'),
      )}
    >
      {hasAccessory || isBandClose ? (
        <header aria-label={title} data-studio-band="" className="h-10 shrink-0">
          <PageColumn className="flex h-full items-center justify-end gap-3">
            {headerAccessory}
            {isBandClose ? <StudioCloseButton label={label} onClose={requestClose} /> : null}
          </PageColumn>
        </header>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 flex-1 bg-background',
          !isSlot && SHEET_CLASSES.flush,
          !isSlot && 'has-[[data-studio-rail]]:border-y-0',
        )}
      >
        <PaneActionsContext.Provider
          value={
            isSlot ? null : (
              <HeaderCloseButton
                label={label}
                onClose={requestClose}
                onClaim={headerCloseClaim.claim}
              />
            )
          }
        >
          {children(requestClose)}
        </PaneActionsContext.Provider>
      </div>
    </div>
  );
};
