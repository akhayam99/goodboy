import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { PANE_RHYTHM } from '../../paneRhythm';

type Props = {
  readonly title?: ReactNode;
  readonly leading?: ReactNode;
  readonly badge?: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly rowTestId?: string;
  readonly titleTestId?: string;
  readonly isHeading?: boolean;
};

type TitleParams = {
  readonly title: ReactNode;
  readonly className: string;
  readonly testId: string | undefined;
  readonly isHeading: boolean;
};

const titleNodeOf = ({ title, className, testId, isHeading }: TitleParams): ReactNode => {
  if (title == null) {
    return <div className="min-w-0 flex-1" />;
  }
  if (isHeading) {
    return (
      <h1 data-testid={testId} className={className}>
        {title}
      </h1>
    );
  }
  return (
    <div data-testid={testId} className={className}>
      {title}
    </div>
  );
};

export const PaneTitleRow = ({
  title,
  leading,
  badge,
  meta,
  actions,
  rowTestId,
  titleTestId,
  isHeading = true,
}: Props) => (
  <div data-slot="pane-title-block" className="flex min-w-0 flex-col">
    <div
      data-slot="pane-title-row"
      data-testid={rowTestId}
      className={cn('flex min-w-0 items-center justify-between gap-3', PANE_RHYTHM.headerRow)}
    >
      {badge != null || leading != null ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {leading}
          {titleNodeOf({
            title,
            className: 'min-w-0 truncate text-title text-foreground',
            testId: titleTestId,
            isHeading,
          })}
          {badge}
        </div>
      ) : (
        titleNodeOf({
          title,
          className: 'min-w-0 flex-1 truncate text-title text-foreground',
          testId: titleTestId,
          isHeading,
        })
      )}
      {actions != null ? (
        <div className="flex shrink-0 items-center justify-end gap-2">{actions}</div>
      ) : null}
    </div>
    {meta != null && meta !== '' ? (
      <div
        data-slot="pane-meta"
        className={cn('min-w-0 truncate text-meta text-muted-foreground', PANE_RHYTHM.headerMeta)}
      >
        {meta}
      </div>
    ) : null}
  </div>
);
