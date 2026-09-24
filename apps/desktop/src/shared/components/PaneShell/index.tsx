import type { ReactElement, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Divider, ScrollFade, cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';

type BaseProps = {
  readonly measure?: keyof typeof PANE_RHYTHM.measure;
  readonly animationClassName?: string;
  readonly scroll?: 'pane' | 'body';
  readonly eyebrow?: ReactNode;
  readonly children: ReactNode;
};

type TitleHeaderProps = {
  readonly title: string;
  readonly icon?: LucideIcon;
  readonly glyph?: ReactNode;
  readonly tone?: Tone;
  readonly description?: string;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly header?: undefined;
};

type CustomHeaderProps = {
  readonly header: ReactElement;
  readonly title?: undefined;
  readonly icon?: undefined;
  readonly glyph?: undefined;
  readonly tone?: undefined;
  readonly description?: undefined;
  readonly meta?: undefined;
  readonly actions?: undefined;
};

type Props = BaseProps & (TitleHeaderProps | CustomHeaderProps);

export const PaneShell = (props: Props) => {
  const {
    measure = 'pane',
    animationClassName = 'motion-safe:animate-studio-in',
    scroll = 'pane',
    eyebrow,
    children,
  } = props;

  const header = (
    <div className="flex min-w-0 flex-col gap-1">
      {eyebrow}
      {props.header !== undefined ? (
        props.header
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-baseline gap-2">
              {props.glyph != null ? (
                <span aria-hidden className="flex shrink-0 translate-y-0.5">
                  {props.glyph}
                </span>
              ) : props.icon != null ? (
                <props.icon
                  size={16}
                  aria-hidden
                  className={cn(
                    'shrink-0 translate-y-0.5',
                    tintClasses(props.tone ?? 'neutral').icon,
                  )}
                />
              ) : null}
              <h1 className="text-xl font-semibold leading-snug text-foreground">{props.title}</h1>
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
    </div>
  );

  if (scroll === 'body') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <div className={cn('flex shrink-0 flex-col', PANE_RHYTHM.header)}>
          <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.measure[measure])}>{header}</div>
        </div>
        <Divider />
        <div className={cn('flex min-h-0 flex-1 flex-col', PANE_RHYTHM.body)}>
          <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
            <div
              className={cn(
                animationClassName,
                PANE_RHYTHM.column,
                PANE_RHYTHM.stack,
                PANE_RHYTHM.measure[measure],
              )}
            >
              {children}
            </div>
          </ScrollFade>
        </div>
      </div>
    );
  }

  return (
    <ScrollFade
      className="h-full min-w-0 flex-1"
      viewportClassName={PANE_RHYTHM.body}
      fadeSize={24}
    >
      <div
        className={cn(
          animationClassName,
          PANE_RHYTHM.column,
          PANE_RHYTHM.stack,
          PANE_RHYTHM.measure[measure],
        )}
      >
        {header}
        {children}
      </div>
    </ScrollFade>
  );
};
