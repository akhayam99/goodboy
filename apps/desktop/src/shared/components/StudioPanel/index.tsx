import type { ReactNode } from 'react';
import { Divider, ScrollFade, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';

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
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className={cn('flex flex-col', PANE_RHYTHM.header)}>
        <div className={cn('flex items-center gap-3', PANE_RHYTHM.column, maxWidthClass)}>
          {icon ?? null}
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle != null ? (
              <span className="text-2xs text-muted-foreground">{subtitle}</span>
            ) : null}
          </div>
          {action != null ? <div className="ml-auto shrink-0">{action}</div> : null}
        </div>
      </div>
      <Divider />
      <div className="min-h-0 flex-1">
        <ScrollFade className="h-full" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
          <div
            className={cn('flex flex-col', PANE_RHYTHM.column, PANE_RHYTHM.stack, maxWidthClass)}
          >
            {children}
          </div>
        </ScrollFade>
      </div>
    </div>
  );
};
