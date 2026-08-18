import { Eyebrow } from '@goodboy/ui';
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
  <section aria-label="Goal" className="flex flex-col gap-2">
    <Eyebrow label="Goal" muted className="px-0.5 font-medium" />
    <div className="rounded-lg border border-border-soft bg-subtle px-4 py-3">
      <ContextRegion
        sessionId={sessionId}
        slotKey="goal"
        title="Goal"
        emptyLabel="No goal yet"
        value={value}
        copyValue={value}
        historyCount={historyCount}
        isLoading={isLoading}
        isSummarizing={isSummarizing}
        onOpenHistory={onOpenHistory}
        clampLines={2}
        fullWidth
        showTitle={false}
      />
    </div>
  </section>
);
