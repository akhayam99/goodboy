import { useMemo } from 'react';
import type { ProviderRunId } from '@goodboy/types';
import type { RetryRunParams } from '../../../retryRun';
import type { TranscriptItem } from '../../../utils/transcript-items';
import { dockFailureOf, type DockFailure } from '../../ConversationDock/dockFailureOf';
import { lastFailureOf } from '../../ConversationDock/lastFailureOf';
import type { ErrorDock } from '../../TranscriptCards/errorDock';

type Params = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly isInDock: boolean;
  readonly hasFailed: boolean;
  readonly retryingRunId: ProviderRunId | null;
  readonly retry: (params: RetryRunParams) => Promise<void>;
};

type Result = Readonly<{
  failure: DockFailure | null;
  errorDock: ErrorDock | null;
}>;

export const useDockFailure = ({
  items,
  isInDock,
  hasFailed,
  retryingRunId,
  retry,
}: Params): Result => {
  const item = useMemo(() => (isInDock ? lastFailureOf({ items }) : null), [isInDock, items]);
  const failure = dockFailureOf({
    item,
    hasFailed,
    isRetrying: retryingRunId !== null && retryingRunId === (item?.runId ?? null),
    onRetry: ({ runId: failedRunId, model }) => void retry({ runId: failedRunId, model }),
  });
  const ownedRunId = failure?.runId ?? null;
  const errorDock = useMemo(
    () => (isInDock ? { runId: ownedRunId } : null),
    [isInDock, ownedRunId],
  );
  return { failure, errorDock };
};
