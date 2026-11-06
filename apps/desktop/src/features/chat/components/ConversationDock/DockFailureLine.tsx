import { Button } from '@goodboy/ui';
import { DockStateLine } from '../../../../shared/components/DockStateLine';
import { NAMES } from '../../../../shared/utils/names';
import { formatErrorForHumans } from '../../formatErrorForHumans';
import { LimitContinueAction } from '../TranscriptCards/LimitContinueAction';
import type { DockFailure } from './dockFailureOf';

type Props = {
  readonly failure: DockFailure;
};

export const DockFailureLine = ({ failure }: Props) => (
  <DockStateLine
    state="failed"
    tone="danger"
    sentence={formatErrorForHumans({ message: failure.message }).body ?? failure.message}
  >
    {failure.runId === null ? null : <LimitContinueAction runId={failure.runId} />}
    {failure.retry === null ? null : (
      <Button
        variant="primary"
        size="sm"
        isBusy={failure.isRetrying}
        busyLabel="Retrying"
        onClick={failure.retry}
      >
        {NAMES.retry}
      </Button>
    )}
  </DockStateLine>
);
