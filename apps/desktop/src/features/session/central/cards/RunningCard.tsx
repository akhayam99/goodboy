import type { Session } from '@goodboy/types';
import { LiveGroup } from '../now/LiveGroup';
import type { LiveGroupModel } from '../now/liveGroupsOf';
import { LiveSection } from '../now/LiveSection';
import { liveSectionsOf } from '../now/liveSectionsOf';
import { StuckActions } from '../now/StuckActions';
import { stuckAutoOf } from '../now/stuckAutoOf';
import type { WhereOf } from '../now/useWhereOf';
import type { SessionWorkModel } from '../useSessionWorkModel';
import type { OverviewCardModel } from '../overviewCardsOf';
import { OverviewCard } from './OverviewCard';

type Props = {
  readonly session: Session;
  readonly card: OverviewCardModel;
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly model: SessionWorkModel;
  readonly whereOf: WhereOf;
  readonly leadRunId: string | null;
};

export const RunningCard = ({ session, card, groups, model, whereOf, leadRunId }: Props) => {
  const stuck = stuckAutoOf({ groups, views: model.autoTrees });
  return (
    <OverviewCard card={card} hasHeader={false} regionLabel={card.title}>
      <div data-running-rows="" className="@container flex min-w-0 flex-col gap-3">
        {liveSectionsOf({ groups }).map((section) => (
          <LiveSection key={section.id} section={section}>
            {section.id === 'stopped' && stuck !== null ? (
              <StuckActions sessionId={session.id} group={stuck.group} view={stuck.view} />
            ) : null}
            <div className="flex min-w-0 flex-col gap-1">
              {section.groups.map((group) => (
                <LiveGroup
                  key={`${group.kind}:${group.id}`}
                  sessionId={session.id}
                  session={session}
                  group={group}
                  where={whereOf({ mountId: group.mountId })}
                  isLead={group.id === leadRunId}
                />
              ))}
            </div>
          </LiveSection>
        ))}
      </div>
    </OverviewCard>
  );
};
