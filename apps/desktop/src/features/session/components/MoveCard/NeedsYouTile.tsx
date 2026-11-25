import type { ReactNode } from 'react';

type Props = {
  readonly title: string;
  readonly meta: string;
  readonly actions: ReactNode;
  readonly below: ReactNode;
  readonly moveId: string;
  readonly sentKey: string | null;
  readonly isPrimary: boolean;
};

export const NeedsYouTile = ({
  title,
  meta,
  actions,
  below,
  moveId,
  sentKey,
  isPrimary,
}: Props) => (
  <div
    data-move={moveId}
    data-sent-key={sentKey ?? undefined}
    data-move-density="row"
    data-move-primary={isPrimary ? '' : undefined}
    className="flex min-w-0 flex-col gap-1 rounded-md bg-background px-3 py-2"
  >
    <div className="flex min-h-10 min-w-0 items-center gap-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 min-w-0 text-pretty text-row text-foreground">{title}</span>
        {meta === '' ? null : (
          <span className="min-w-0 truncate text-meta text-muted-foreground">{meta}</span>
        )}
      </span>
      {actions}
    </div>
    {below}
  </div>
);
