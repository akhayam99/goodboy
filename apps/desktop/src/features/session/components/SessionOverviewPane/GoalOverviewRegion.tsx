import type { SessionId } from '@goodboy/types';
import { ContextRegion } from '../SessionWorkspace/parts/ContextPane/ContextRegion';

type Props = {
  readonly sessionId: SessionId;
  readonly value: string;
  readonly historyCount: number;
  readonly isLoading: boolean;
  readonly isSummarizing: boolean;
  readonly onOpenHistory: () => void;
};

export const GoalOverviewRegion = ({
  sessionId,
  value,
  historyCount,
  isLoading,
  isSummarizing,
  onOpenHistory,
}: Props) => (
  <ContextRegion
    sessionId={sessionId}
    slotKey="goal"
    title="Goal"
    description="What this session is meant to achieve."
    emptyLabel="No goal yet"
    value={value}
    copyValue={value}
    historyCount={historyCount}
    isLoading={isLoading}
    isSummarizing={isSummarizing}
    onOpenHistory={onOpenHistory}
    clampLines={4}
  />
);
