import type { ReactNode } from 'react';
import { cn, Divider, type Tone } from '@goodboy/ui';
import type { LucideIcon } from 'lucide-react';
import { useStudioOverlay } from '../../hooks/useStudioOverlay';
import { OverlayHeader } from '@goodboy/ui';

type Props = {
  readonly icon?: LucideIcon;
  readonly tone?: Tone;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly workspaceName: string;
  readonly closeLabel: string;
  readonly headerAccessory?: ReactNode;
  readonly onClose: () => void;
  readonly variant?: 'fullscreen' | 'slot' | 'viewport';
  readonly children: (requestClose: () => void) => ReactNode;
};

export const StudioShell = ({
  icon: Icon,
  tone,
  glyph,
  title,
  workspaceName,
  closeLabel,
  headerAccessory,
  onClose,
  variant = 'fullscreen',
  children,
}: Props) => {
  const { closing, requestClose } = useStudioOverlay(onClose);

  return (
    <div
      {...(variant === 'slot' ? {} : { 'data-studio-overlay': '' })}
      className={cn(
        variant === 'slot'
          ? 'relative h-full w-full flex flex-col bg-background'
          : variant === 'viewport'
            ? 'fixed inset-0 z-50 flex flex-col bg-background'
            : 'fixed inset-x-0 bottom-9 top-9 z-50 flex flex-col bg-background',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      <OverlayHeader
        heightClassName="h-[var(--chat-header-h)]"
        icon={Icon}
        {...(tone != null && { tone })}
        glyph={glyph}
        title={title}
        subtitle={workspaceName}
        onClose={requestClose}
        closeLabel={closeLabel}
        variant={variant === 'slot' ? 'compact' : 'fullscreen'}
      >
        {headerAccessory}
      </OverlayHeader>
      <Divider />

      <div className="flex min-h-0 flex-1">{children(requestClose)}</div>
    </div>
  );
};
