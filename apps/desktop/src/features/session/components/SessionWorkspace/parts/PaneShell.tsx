import type { ReactNode } from 'react';
import { cn, ScrollFade } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly description?: string;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly width?: '2xl' | '3xl' | '5xl';
  readonly children: ReactNode;
};

const WIDTH: Record<'2xl' | '3xl' | '5xl', string> = {
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '5xl': 'max-w-5xl',
};

export const PaneShell = ({
  title,
  description,
  meta,
  actions,
  width = '2xl',
  children,
}: Props) => (
  <ScrollFade className="h-full" viewportClassName="px-6 py-5" fadeSize={24}>
    <div className={cn('mx-auto flex flex-col gap-5 motion-safe:animate-studio-in', WIDTH[width])}>
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
