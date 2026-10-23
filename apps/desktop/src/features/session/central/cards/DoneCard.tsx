import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { OverviewCardModel } from '../overviewCardsOf';
import type { DoneSummary } from './doneSummaryOf';
import { OverviewCard } from './OverviewCard';

type Props = {
  readonly sessionId: SessionId;
  readonly card: OverviewCardModel;
  readonly summary: DoneSummary;
};

export const DoneCard = ({ sessionId, card, summary }: Props) => {
  const openDrawer = useAppStore((state) => state.openDrawer);
  return (
    <OverviewCard
      card={card}
      aside={
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            openDrawer({ kind: 'session-log', sessionId, payload: { focusEntryId: null } })
          }
        >
          Full log
        </Button>
      }
    >
      <p data-done-line="" className="min-w-0 text-ui text-muted-foreground">
        {summary.line}
      </p>
    </OverviewCard>
  );
};
