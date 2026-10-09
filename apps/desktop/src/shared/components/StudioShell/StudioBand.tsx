import type { ReactNode } from 'react';
import {
  Button,
  PageColumn,
  tintClasses,
  Trail,
  type PageColumnWidth,
  type Tone,
} from '@goodboy/ui';
import { X, type LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS, ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly crumbKey: string;
  readonly icon?: LucideIcon;
  readonly tone?: Tone;
  readonly width?: PageColumnWidth;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly closeLabel: string;
  readonly isClosable?: boolean;
  readonly accessory?: ReactNode;
  readonly isTrailClaimed?: boolean;
  readonly trailSlotRef?: (node: HTMLDivElement | null) => void;
  readonly onClose: () => void;
};

export const StudioBand = ({
  crumbKey,
  icon,
  tone = 'primary',
  width = 'column',
  glyph,
  title,
  subtitle,
  closeLabel,
  isClosable = true,
  accessory,
  isTrailClaimed = false,
  trailSlotRef,
  onClose,
}: Props) => (
  <>
    <header aria-label={title} data-studio-band="" className="h-10 shrink-0">
      <PageColumn width={width} className="flex h-full items-center gap-3">
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
                        <span className="truncate text-meta text-muted-foreground">{subtitle}</span>
                      ),
                    }),
                },
              ]}
            />
          )}
        </div>
        {accessory}
        {isClosable ? (
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel}>
            <X size={ICON_SIZE.control} aria-hidden /> Close
          </Button>
        ) : null}
      </PageColumn>
    </header>
  </>
);
