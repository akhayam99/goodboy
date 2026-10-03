import type { ReactNode } from 'react';
import { Button, tintClasses, Trail, type Tone } from '@goodboy/ui';
import { X, type LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../conceptIcons';

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
            segments={[
              {
                id: crumbKey,
                label: title,
                icon: icon ?? CONCEPT_ICONS.more,
                ...(glyph != null && { glyph }),
                iconClassName: tintClasses(tone).icon,
                ...(subtitle != null &&
                  subtitle !== '' && {
                    accessory: (
                      <span className="truncate text-secondary text-muted-foreground">
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
      <Button variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel}>
        <X size={13} aria-hidden /> Close
      </Button>
    </header>
  </>
);
