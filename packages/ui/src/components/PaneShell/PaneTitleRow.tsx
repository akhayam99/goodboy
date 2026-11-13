import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { PANE_RHYTHM } from '../../paneRhythm';

type Props = {
  readonly title: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly rowTestId?: string;
  readonly titleTestId?: string;
};

export const PaneTitleRow = ({ title, meta, actions, rowTestId, titleTestId }: Props) => (
  <div data-slot="pane-title-block" className="flex min-w-0 flex-col">
    <div
      data-slot="pane-title-row"
      data-testid={rowTestId}
      className={cn('flex min-w-0 items-center justify-between gap-3', PANE_RHYTHM.headerRow)}
    >
      <h1 data-testid={titleTestId} className="min-w-0 flex-1 truncate text-title text-foreground">
        {title}
      </h1>
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
