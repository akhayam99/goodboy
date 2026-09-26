import type { ReactNode } from 'react';
import { cn, Divider, tintClasses, Trail, type Tone } from '@goodboy/ui';
import { X, type LucideIcon } from 'lucide-react';

type Props = {
  readonly crumbKey: string;
  readonly icon?: LucideIcon;
  readonly tone?: Tone;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly closeLabel: string;
  readonly accessory?: ReactNode;
  readonly isTrailClaimed?: boolean;
  readonly trailSlotRef?: (node: HTMLDivElement | null) => void;
  readonly onClose: () => void;
};

export const StudioBand = ({
  crumbKey,
  icon,
  tone = 'primary',
  glyph,
  title,
  subtitle,
  closeLabel,
  accessory,
  isTrailClaimed = false,
  trailSlotRef,
  onClose,
}: Props) => (
  <>
    <header
      aria-label={title}
      data-studio-band=""
      className="flex h-10 shrink-0 items-center gap-3 px-6"
    >
      <div
        ref={trailSlotRef}
        data-slot="studio-trail"
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        {isTrailClaimed ? null : (
          <Trail
            lead={glyph != null ? <span className="flex shrink-0">{glyph}</span> : undefined}
            segments={[
              {
                id: crumbKey,
                label: title,
                icon: glyph != null ? null : (icon ?? null),
                iconClassName: tintClasses(tone).icon,
                ...(subtitle != null &&
                  subtitle !== '' && {
                    accessory: (
                      <span className="truncate text-2xs font-normal text-muted-foreground">
                        {subtitle}
                      </span>
                    ),
                  }),
              },
            ]}
          />
        )}
      </div>
      {accessory}
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className={cn(
          'inline-flex h-6 items-center gap-1.5 rounded-md border border-border px-2.5',
          'text-xs font-semibold text-muted-foreground transition-colors',
          'hover:bg-hover hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        )}
      >
        <X size={13} aria-hidden /> Done
      </button>
    </header>
    <Divider />
  </>
);
