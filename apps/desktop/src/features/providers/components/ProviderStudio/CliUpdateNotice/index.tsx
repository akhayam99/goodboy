import { useEffect, useRef } from 'react';
import { cleanCliVersion, newestCliVersion } from '@goodboy/core';
import { Button, Notice } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CLI_LABEL } from '../../../cliLabel';
import { useCliUpdate } from '../../../hooks/useCliUpdate';
import { useOutdatedCliModels } from '../../../hooks/useOutdatedCliModels';
import { InlineTerminal } from '../../InlineTerminal';

type Props = {
  readonly providerId: ProviderId;
  readonly autoStart: boolean;
};

type LabelParams = {
  readonly labels: ReadonlyArray<string>;
};

const joinLabels = ({ labels }: LabelParams): string => {
  if (labels.length <= 1) {
    return labels.join('');
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
};

export const CliUpdateNotice = ({ providerId, autoStart }: Props) => {
  const cli = CLI_LABEL[providerId];
  const update = useCliUpdate({ providerId });
  const gates = useOutdatedCliModels({ providerId });
  const liveVersion = useAppStore(
    (state) => state.providers.find((item) => item.id === providerId)?.version ?? null,
  );
  const startedRef = useRef(false);
  const isOutdated = gates.length > 0;
  const { start, isBlockedByTurn, isUpdating } = update;

  useEffect(() => {
    if (!autoStart || startedRef.current || !isOutdated || isBlockedByTurn || isUpdating) {
      return;
    }
    startedRef.current = true;
    start();
  }, [autoStart, isBlockedByTurn, isOutdated, isUpdating, start]);

  if (!isOutdated) {
    const live = cleanCliVersion({ raw: liveVersion });
    if (!update.hasFinished || live === null) {
      return null;
    }
    return (
      <Notice
        tone="success"
        placement="banner"
        role="status"
        title={`${cli} updated to ${live}.`}
        body="Every model in the catalog runs on it."
      />
    );
  }

  const required = newestCliVersion({ versions: gates.map((gate) => gate.requiredVersion) });
  const installed = gates[0]?.installedVersion ?? '';
  const waitNote = isBlockedByTurn && !isUpdating ? ' Wait for running turns to finish.' : '';
  const failedNote = update.hasFailed ? " The update didn't finish." : '';

  return (
    <Notice
      tone="warning"
      placement="banner"
      title={`Update needed for ${joinLabels({ labels: gates.map((gate) => gate.model.label) })}`}
      body={`${required ?? ''} or newer. You have ${installed}.${failedNote}${waitNote}`}
      detail={update.hasFailed ? update.errorTail : null}
      actions={
        <Button
          size="sm"
          variant="secondary"
          isBusy={isUpdating}
          busyLabel={`Updating ${cli}`}
          disabled={isBlockedByTurn}
          onClick={start}
        >
          {update.hasFailed ? 'Try again' : `Update ${cli}`}
        </Button>
      }
    >
      {update.runId !== null && (isUpdating || update.hasFailed) && (
        <InlineTerminal runId={update.runId} isActive heightClass="h-44" />
      )}
    </Notice>
  );
};
