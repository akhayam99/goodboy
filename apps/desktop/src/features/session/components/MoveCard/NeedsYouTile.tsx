import type { ReactNode } from 'react';
import { TruncatedText } from '@goodboy/ui';

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
        <TruncatedText lines={2} isFocusable className="min-w-0 text-row text-foreground">
          {title}
        </TruncatedText>
        {meta === '' ? null : (
          <TruncatedText isFocusable className="min-w-0 text-meta text-muted-foreground">
            {meta}
          </TruncatedText>
        )}
      </span>
      {actions}
    </div>
    {below}
  </div>
);
