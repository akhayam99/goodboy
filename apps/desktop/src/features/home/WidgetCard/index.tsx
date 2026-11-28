import type { ReactNode } from 'react';
import { CountBadge, ICON_SIZE, cn, tintClasses, type Tone } from '@goodboy/ui';
import type { IconGlyph } from '@goodboy/ui/icons';
import type { HomeWidgetId } from '../grid/homeWidgets';

type Props = {
  readonly id: HomeWidgetId;
  readonly title: string;
  readonly icon: IconGlyph;
  readonly count?: number;
  readonly tone?: Tone;
  readonly isWarm?: boolean;
  readonly aside?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
};

export const WidgetCard = ({
  id,
  title,
  icon: Icon,
  count = 0,
  tone = 'neutral',
  isWarm = false,
  aside,
  footer,
  children,
}: Props) => (
  <section
    aria-label={title}
    data-home-widget={id}
    className={cn(
      'flex h-full min-h-0 min-w-0 flex-col gap-3 rounded-lg border bg-elevated p-3 text-foreground shadow-sm',
      isWarm ? tintClasses('warning').border : 'border-border-soft',
    )}
  >
    <header className="flex h-5 min-w-0 shrink-0 items-center gap-2">
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
      <h2 className="min-w-0 truncate text-eyebrow text-muted-foreground">{title}</h2>
      <CountBadge
        count={count}
        tone={tone === 'warning' || tone === 'danger' ? tone : 'neutral'}
        label={`${count} ${title.toLowerCase()}`}
        isAnnounced={false}
      />
      <span aria-hidden className="min-w-0 flex-1" />
      {aside}
    </header>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">{children}</div>
    {footer === undefined ? null : (
      <div className="flex h-5 shrink-0 items-center justify-end text-meta">{footer}</div>
    )}
  </section>
);
