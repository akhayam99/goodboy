import { EmptyState, Skeleton, cn } from '@goodboy/ui';
import type { SentryStackFrame } from '../client';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly frames: ReadonlyArray<SentryStackFrame>;
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const SentryStackTrace = ({ frames, isLoading, error }: Props) => {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading latest event"
        className="flex flex-col gap-2 rounded-lg border border-border-soft bg-subtle/40 p-3"
      >
        {['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-2/5', 'w-3/5'].map((width) => (
          <Skeleton key={width} className={cn('h-2.5 rounded', width)} />
        ))}
      </div>
    );
  }

  if (error != null) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  if (frames.length === 0) {
    return (
      <EmptyState
        icon={CONCEPT_ICONS.sentry}
        title="No stack trace available"
        className="items-start px-0 py-0 text-left"
      />
    );
  }

  return (
    <pre className="overflow-x-auto rounded-lg border border-border-soft bg-subtle/40 p-3 font-mono text-2xs leading-relaxed text-muted-foreground">
      {frames
        .map(
          (frame) =>
            `${frame.in_app ? '› ' : '  '}${frame.function ?? '?'} (${frame.filename ?? '?'}${
              frame.line_no != null ? `:${frame.line_no}` : ''
            })`,
        )
        .join('\n')}
    </pre>
  );
};
