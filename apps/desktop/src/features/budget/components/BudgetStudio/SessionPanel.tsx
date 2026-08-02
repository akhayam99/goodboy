import type { SessionId } from '@goodboy/types';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import { PanelLoading } from '../../../../shared/components/PanelLoading';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import type { QueryResult } from '../../../../shared/types/queryResult';
import type { WorkspaceTurn } from './lib';
import { SessionBudgetContent } from './SessionBudgetContent';

type Props = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly isCurrent: boolean;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly softCapUsd: number | null;
  readonly telemetryResult: QueryResult<void>;
  readonly budgetResult: QueryResult<void>;
  readonly isLoading: boolean;
  readonly onSaveCap: (capUsd: number) => Promise<void>;
  readonly onOpened: () => void;
  readonly onRetryTelemetry: () => void;
  readonly onRetryBudget: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const SessionPanel = ({
  sessionId,
  goal,
  isCurrent,
  turns,
  softCapUsd,
  telemetryResult,
  budgetResult,
  isLoading,
  onSaveCap,
  onOpened,
  onRetryTelemetry,
  onRetryBudget,
  onOpenSession,
}: Props) => {
  return (
    <StudioPanel
      title={goal}
      subtitle={isCurrent ? 'current session' : 'session spend'}
      action={<OpenSessionButton sessionId={sessionId} onOpened={onOpened} variant="secondary" />}
      maxWidthClass="max-w-5xl"
    >
      <ErrorStrip
        label="session telemetry"
        error={telemetryResult.error}
        onRetry={onRetryTelemetry}
      />
      <ErrorStrip label="session budget" error={budgetResult.error} onRetry={onRetryBudget} />
      {isLoading && <PanelLoading label="Loading budget data" />}
      <SessionBudgetContent
        turns={turns}
        softCapUsd={softCapUsd}
        onSaveCap={onSaveCap}
        onOpenSession={onOpenSession}
      />
    </StudioPanel>
  );
};
