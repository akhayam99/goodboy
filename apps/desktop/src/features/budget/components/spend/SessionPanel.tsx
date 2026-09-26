import type { ReactElement } from 'react';
import type { SessionId } from '@goodboy/types';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { ErrorStrip } from '@goodboy/ui';
import { PanelLoading } from '@goodboy/ui';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { SpendAnchorTitle } from './SpendAnchorTitle';
import type { QueryResult } from '../../../../shared/types/queryResult';
import type { WorkspaceTurn } from './lib';
import { SessionBudgetContent } from './SessionBudgetContent';

type Props = {
  readonly header: ReactElement;
  readonly onBack: () => void;
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
  header,
  onBack,
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
    <PaneShell scroll="body" header={header}>
      <SpendAnchorTitle
        title={goal}
        meta={isCurrent ? 'Current session' : 'Session spend'}
        actions={
          <OpenSessionButton sessionId={sessionId} onOpened={onOpened} variant="secondary" />
        }
        onBack={onBack}
      />
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
    </PaneShell>
  );
};
