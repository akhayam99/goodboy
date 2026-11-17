import { TriangleAlert } from '@goodboy/ui/icons';
import { Button, EmptyLine, ICON_SIZE, SkeletonRow } from '@goodboy/ui';
import type { InboxProvider } from '../../../../inbox/types';
import { TASK_PICKER_COPY } from './taskPickerCopy';
import type { TaskPickerView } from './taskPickerView';

type Props = {
  readonly view: TaskPickerView;
  readonly query: string;
  readonly loading: Readonly<Record<InboxProvider, boolean>>;
  readonly errors: Readonly<Record<InboxProvider, string | null>>;
  readonly onRetry: () => void;
};

const SKELETON_ROWS = ['first', 'second', 'third'];

export const TaskPickerNotice = ({ view, query, loading, errors, onRetry }: Props) => {
  const shown = view.source === 'all' ? view.sources : [view.source];
  const failed = shown.filter((provider) => errors[provider] !== null);
  const isLoading = shown.some((provider) => loading[provider]);
  const isEmpty = view.items.length === 0;
  const trimmed = query.trim();
  const isAllFailed = failed.length > 0 && failed.length === shown.length;

  return (
    <>
      {failed.length > 0 ? (
        <div
          role="alert"
          className="flex min-h-8 min-w-0 items-center gap-2 px-2 text-meta text-muted-foreground"
        >
          <TriangleAlert size={ICON_SIZE.row} aria-hidden className="shrink-0 text-warning" />
          <span className="min-w-0 flex-1 truncate">
            {TASK_PICKER_COPY.failed({ providers: failed })}
          </span>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            {TASK_PICKER_COPY.retry}
          </Button>
        </div>
      ) : null}
      {isEmpty && isLoading
        ? SKELETON_ROWS.map((row) => <SkeletonRow key={row} label={TASK_PICKER_COPY.loading} />)
        : null}
      {isEmpty && !isLoading && !isAllFailed ? (
        <EmptyLine className="px-2">
          {trimmed === ''
            ? TASK_PICKER_COPY.empty({ provider: view.source })
            : TASK_PICKER_COPY.noMatch({ query: trimmed })}
        </EmptyLine>
      ) : null}
    </>
  );
};
