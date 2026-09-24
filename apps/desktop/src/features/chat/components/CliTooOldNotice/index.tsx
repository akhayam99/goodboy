import { useMemo } from 'react';
import {
  catalogModelForId,
  cleanCliVersion,
  cliSupportedSibling,
  isCliVersionBelow,
} from '@goodboy/core';
import { Button, Notice } from '@goodboy/ui';
import type { ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CLI_LABEL } from '../../../providers/cliLabel';
import { InlineTerminal } from '../../../providers/components/InlineTerminal';
import { useCliUpdate } from '../../../providers/hooks/useCliUpdate';
import type { RetryRunParams } from '../../retryRun';
import type { CliTooOldPayload } from '../../turn';

type Props = {
  readonly payload: CliTooOldPayload;
  readonly runId: ProviderRunId | null;
  readonly onRetryRun?: (params: RetryRunParams) => void;
  readonly isRetrying: boolean;
};

export const CliTooOldNotice = ({ payload, runId, onRetryRun, isRetrying }: Props) => {
  const { providerId, modelKey, installedVersion, requiredVersion, fallbackModelKey, detail } =
    payload;
  const cli = CLI_LABEL[providerId];
  const update = useCliUpdate({ providerId });
  const liveVersion = useAppStore(
    (state) => state.providers.find((provider) => provider.id === providerId)?.version ?? null,
  );
  const learned = useAppStore((state) => state.cliRequirements);
  const live = cleanCliVersion({ raw: liveVersion });
  const current = live ?? installedVersion;
  const model =
    modelKey === null ? null : catalogModelForId({ provider: providerId, modelId: modelKey });
  const modelLabel = model?.label ?? 'This model';
  const fallback =
    fallbackModelKey === null
      ? null
      : catalogModelForId({ provider: providerId, modelId: fallbackModelKey });
  const sibling = useMemo(
    () =>
      fallbackModelKey !== null || modelKey === null
        ? null
        : cliSupportedSibling({
            provider: providerId,
            modelKey,
            installedVersion: current,
            learned,
          }),
    [current, fallbackModelKey, learned, modelKey, providerId],
  );
  const canRetry = runId !== null && onRetryRun !== undefined;
  const retry = ({ model: retryModel }: { readonly model: string | null }) => {
    if (runId === null || onRetryRun === undefined) {
      return;
    }
    onRetryRun({ runId, model: retryModel });
  };
  const isReady =
    live !== null && !isCliVersionBelow({ installed: live, required: requiredVersion });

  if (isReady) {
    return (
      <Notice
        tone="success"
        placement="transcript"
        title={update.hasFinished ? `${cli} updated to ${live}.` : `${cli} ${live} is installed.`}
        body={
          fallback === null
            ? `${modelLabel} is ready in this session.`
            : `${modelLabel} is ready. This turn already ran on ${fallback.label}.`
        }
        actions={
          fallback === null &&
          canRetry && (
            <Button
              size="sm"
              variant="secondary"
              isBusy={isRetrying}
              busyLabel="Retrying"
              onClick={() => retry({ model: null })}
            >
              Retry the turn
            </Button>
          )
        }
      />
    );
  }

  const outcome =
    fallback === null ? 'Your message is kept.' : `This turn ran on ${fallback.label} instead.`;
  const waitNote =
    update.isBlockedByTurn && !update.isUpdating ? ' Wait for running turns to finish.' : '';
  const failedNote = update.hasFailed ? " The update didn't finish." : '';

  return (
    <Notice
      tone="warning"
      placement="transcript"
      title={`${modelLabel} needs a newer ${cli}`}
      body={`You have ${cli} ${current}. ${modelLabel} needs ${requiredVersion} or newer. ${outcome}${failedNote}${waitNote}`}
      detail={update.hasFailed && update.errorTail !== null ? update.errorTail : detail}
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            isBusy={update.isUpdating}
            busyLabel={`Updating ${cli}`}
            disabled={update.isBlockedByTurn}
            onClick={update.start}
          >
            {update.hasFailed ? 'Try again' : `Update ${cli}`}
          </Button>
          {sibling !== null && canRetry && !update.isUpdating && (
            <Button
              size="sm"
              variant="ghost"
              isBusy={isRetrying}
              busyLabel="Retrying"
              onClick={() => retry({ model: sibling.key })}
            >
              {`Use ${sibling.label} instead`}
            </Button>
          )}
        </>
      }
    >
      {update.runId !== null && (update.isUpdating || update.hasFailed) && (
        <InlineTerminal runId={update.runId} isActive heightClass="h-36" />
      )}
    </Notice>
  );
};
