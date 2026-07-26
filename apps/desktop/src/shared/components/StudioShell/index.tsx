import type { ReactNode } from 'react';
import { cn, Divider } from '@goodboy/ui';
import { X, type LucideIcon } from 'lucide-react';
import { useStudioOverlay } from '../../hooks/useStudioOverlay';
import { OverlayHeader } from '../OverlayHeader';

type Props = {
  readonly icon?: LucideIcon;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly workspaceName: string;
  readonly closeLabel: string;
  readonly headerAccessory?: ReactNode;
  readonly onClose: () => void;
  readonly variant?: 'fullscreen' | 'slot';
  readonly children: (requestClose: () => void) => ReactNode;
};

export const StudioShell = ({
  icon: Icon,
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
      className={cn(
        variant === 'slot'
          ? 'relative h-full w-full flex flex-col bg-background'
          : 'fixed inset-x-0 bottom-9 top-9 z-50 flex flex-col bg-background',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      {variant === 'slot' ? (
        <OverlayHeader
          icon={Icon}
          title={title}
          subtitle={workspaceName}
          beta
          onClose={requestClose}
          closeLabel={closeLabel}
        >
          {headerAccessory}
        </OverlayHeader>
      ) : (
        <header className="flex shrink-0 items-center gap-3 px-6 py-3">
          {glyph ??
            (Icon ? <Icon size={18} className="shrink-0 text-primary" aria-hidden /> : null)}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground">{title}</h1>
              <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
                beta
              </span>
            </div>
            <span className="truncate text-2xs text-muted-foreground">{workspaceName}</span>
          </div>
          <div className="flex-1" />
          {headerAccessory}
          <button
            type="button"
            onClick={requestClose}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5',
              'text-xs font-semibold text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            )}
            aria-label={closeLabel}
          >
            <X size={13} aria-hidden /> Done
          </button>
        </header>
      )}
      <Divider />

      <div className="flex min-h-0 flex-1">{children(requestClose)}</div>
    </div>
  );
};
