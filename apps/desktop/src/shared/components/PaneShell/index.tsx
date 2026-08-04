import type { ReactNode } from 'react';
import { ScrollFade, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '../paneRhythm';

type Props = {
  readonly title: string;
  readonly description?: string;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly measure?: keyof typeof PANE_RHYTHM.measure;
  readonly children: ReactNode;
};

export const PaneShell = ({
  title,
  description,
  meta,
  actions,
  measure = 'pane',
  children,
}: Props) => (
  <ScrollFade className="h-full" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
    <div
      className={cn(
        'flex flex-col motion-safe:animate-studio-in',
        PANE_RHYTHM.column,
        PANE_RHYTHM.stack,
        PANE_RHYTHM.measure[measure],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-semibold leading-snug text-foreground">{title}</h1>
            {meta ? (
              <span className="text-xs tabular-nums text-muted-foreground">{meta}</span>
            ) : null}
          </div>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 pt-0.5">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  </ScrollFade>
);
