import type { ProviderRunId } from '@goodboy/types';
import type { RetryRunParams } from '../../retryRun';
import type { FailureItem } from './lastFailureOf';

export type DockFailure = Readonly<{
  message: string;
  runId: ProviderRunId | null;
  isRetrying: boolean;
  retry: (() => void) | null;
}>;

type Params = {
  readonly item: FailureItem | null;
  readonly hasFailed: boolean;
  readonly isRetrying: boolean;
  readonly onRetry: (params: RetryRunParams) => void;
};

export const dockFailureOf = ({
  item,
  hasFailed,
  isRetrying,
  onRetry,
}: Params): DockFailure | null => {
  if (item === null || !hasFailed) {
    return null;
  }
  const runId = item.runId ?? null;
  return {
    message: item.message,
    runId,
    isRetrying,
    retry: item.retryable === true && runId !== null ? () => onRetry({ runId, model: null }) : null,
  };
};
