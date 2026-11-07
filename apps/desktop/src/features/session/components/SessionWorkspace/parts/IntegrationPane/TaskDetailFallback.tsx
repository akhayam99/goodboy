import type { SessionExternalTask } from '@goodboy/types';
import { ErrorStrip, PaneShell, Skeleton } from '@goodboy/ui';
import { RecordProperties } from '../../../../../../shared/components/StudioDetail/RecordProperties';

type Props = {
  readonly task: SessionExternalTask;
  readonly providerName: string;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
};

export const TaskDetailFallback = ({ task, providerName, isLoading, error, onRetry }: Props) => (
  <PaneShell
    scroll="body"
    title={task.title}
    meta={<span className="font-mono">{task.identifier}</span>}
  >
    {isLoading ? (
      <div
        role="status"
        aria-label={`Loading ${providerName} issue`}
        className="flex flex-col gap-3"
      >
        <Skeleton className="h-4 w-2/3 rounded-sm" />
        <Skeleton className="h-3 w-full rounded-sm" />
        <Skeleton className="h-3 w-3/4 rounded-sm" />
      </div>
    ) : null}
    <RecordProperties facts={[]} />
    {error !== null ? (
      <ErrorStrip label={`the ${providerName} issue`} error={new Error(error)} onRetry={onRetry} />
    ) : null}
  </PaneShell>
);
