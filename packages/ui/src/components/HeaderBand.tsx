import type { ReactNode } from 'react';
import { cn } from '../cn';

type Props = {
  readonly meta: ReactNode;
  readonly title: ReactNode;
  readonly afterTitle?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
};

export const HeaderBand = ({ meta, title, afterTitle, subtitle, actions }: Props) => {
  const hasAfterTitle = afterTitle != null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <div
          data-slot="pane-title-row"
          className={cn('flex h-8 min-w-0 items-center', hasAfterTitle ? 'gap-2' : 'gap-4')}
        >
          <h1
            className={cn(
              'min-w-0 truncate text-title text-foreground',
              !hasAfterTitle && 'flex-1',
            )}
          >
            {title}
          </h1>
          {hasAfterTitle ? (
            <>
              <div className="flex shrink-0 items-center">{afterTitle}</div>
              <div aria-hidden className="min-w-0 flex-1" />
            </>
          ) : null}
          {actions != null ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">{meta}</div>
      </div>
      {subtitle ?? null}
    </div>
  );
};
