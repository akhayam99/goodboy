import type { ReactNode } from 'react';
import { Divider, ScrollFade, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '../paneRhythm';

type Props = {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly action?: ReactNode;
  readonly maxWidthClass?: string;
  readonly children: ReactNode;
};

export const StudioPanel = ({
  icon,
  title,
  subtitle,
  action,
  maxWidthClass = PANE_RHYTHM.measure.pane,
  children,
}: Props) => {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-3', PANE_RHYTHM.header)}>
        {icon ?? null}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-semibold text-foreground">{title}</span>
          {subtitle != null ? (
            <span className="text-2xs text-muted-foreground">{subtitle}</span>
          ) : null}
        </div>
        {action != null ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      <Divider />
      <div className="min-h-0 flex-1">
        <ScrollFade
          className={cn('h-full', maxWidthClass)}
          viewportClassName={PANE_RHYTHM.body}
          fadeSize={24}
        >
          <div className={cn('flex flex-col', PANE_RHYTHM.stack)}>{children}</div>
        </ScrollFade>
      </div>
    </div>
  );
};
