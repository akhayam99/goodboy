import { Button, EmptyLine, Notice, SkeletonRow } from '@goodboy/ui';
import type { loadStateOf } from '../../../../shared/lib/loadStateOf';

type Props = {
  readonly loadState: ReturnType<typeof loadStateOf>;
  readonly error: string | null;
  readonly isEmpty: boolean;
  readonly isFiltered: boolean;
  readonly onRetry: () => void;
  readonly onClearFilter: () => void;
};

export const ChatListStatus = ({
  loadState,
  error,
  isEmpty,
  isFiltered,
  onRetry,
  onClearFilter,
}: Props) => {
  if (loadState === 'loading') {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <SkeletonRow key={index} label="Loading chats" />
        ))}
      </div>
    );
  }
  if (loadState === 'error') {
    return (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title="Couldn't load chats"
        detail={error}
        actions={
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }
  if (!isEmpty || !isFiltered) {
    return null;
  }
  return (
    <EmptyLine
      action={
        <Button size="sm" variant="ghost" onClick={onClearFilter}>
          Clear filter
        </Button>
      }
    >
      No chats match this filter.
    </EmptyLine>
  );
};
