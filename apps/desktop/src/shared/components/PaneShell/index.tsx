import type { ReactElement, ReactNode } from 'react';
import { ScrollFade, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';

type BaseProps = {
  readonly measure?: keyof typeof PANE_RHYTHM.measure;
  readonly children: ReactNode;
};

type TitleHeaderProps = {
  readonly title: string;
  readonly description?: string;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly header?: undefined;
};

type CustomHeaderProps = {
  readonly header: ReactElement;
  readonly title?: undefined;
  readonly description?: undefined;
  readonly meta?: undefined;
  readonly actions?: undefined;
};

type Props = BaseProps & (TitleHeaderProps | CustomHeaderProps);

export const PaneShell = (props: Props) => {
  const { measure = 'pane', children } = props;

  return (
    <ScrollFade className="h-full" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
      <div
        className={cn(
          'flex flex-col motion-safe:animate-studio-in',
          PANE_RHYTHM.column,
          PANE_RHYTHM.stack,
          PANE_RHYTHM.measure[measure],
        )}
      >
        {props.header !== undefined ? (
          props.header
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-semibold leading-snug text-foreground">
                  {props.title}
                </h1>
                {props.meta ? (
                  <span className="text-xs tabular-nums text-muted-foreground">{props.meta}</span>
                ) : null}
              </div>
              {props.description ? (
                <p className="text-sm text-muted-foreground">{props.description}</p>
              ) : null}
            </div>
            {props.actions ? (
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 pt-0.5">
                {props.actions}
              </div>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </ScrollFade>
  );
};
