import type { SessionId } from '@goodboy/types';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { ErrorStrip, PaneShell, StatCardsSkeleton } from '@goodboy/ui';
import { failedReadsOf } from '../../../../shared/utils/failedReadsOf';
import { CostGuideLink } from './CostGuideLink';
import { SpendAnchorTitle } from './SpendAnchorTitle';
import type { QueryResult } from '../../../../shared/types/queryResult';
import type { WorkspaceTurn } from './lib';
import { SessionBudgetContent } from './SessionBudgetContent';
import type { PaneFrame } from '../../../../shared/types/paneFrame';

type Props = {
  readonly frame: PaneFrame;
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly isCurrent: boolean;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly telemetryResult: QueryResult<void>;
  readonly budgetResult: QueryResult<void>;
  readonly isLoading: boolean;
  readonly onOpened: () => void;
  readonly onRetryTelemetry: () => void;
  readonly onRetryBudget: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const SessionPanel = ({
  frame,
  sessionId,
  goal,
  isCurrent,
  turns,
  telemetryResult,
  budgetResult,
  isLoading,
  onOpened,
  onRetryTelemetry,
  onRetryBudget,
  onOpenSession,
}: Props) => {
  const failed = failedReadsOf({
    reads: [
      { label: 'session telemetry', error: telemetryResult.error },
      { label: 'session budget', error: budgetResult.error },
    ],
  });
  const retryFailed = () => {
    if (telemetryResult.error !== null) {
      onRetryTelemetry();
    }
    if (budgetResult.error !== null) {
      onRetryBudget();
    }
  };
  return (
    <PaneShell scroll="body" {...frame}>
      <SpendAnchorTitle
        title={goal}
        meta={isCurrent ? 'Current session' : 'Session spend'}
        actions={
          <OpenSessionButton sessionId={sessionId} onOpened={onOpened} variant="secondary" />
        }
      />
      <ErrorStrip labels={failed.labels} error={failed.error} onRetry={retryFailed} />
      {isLoading && <StatCardsSkeleton label="Loading budget data" />}
      <SessionBudgetContent turns={turns} sessionId={sessionId} onOpenSession={onOpenSession} />
      <CostGuideLink />
    </PaneShell>
  );
};
