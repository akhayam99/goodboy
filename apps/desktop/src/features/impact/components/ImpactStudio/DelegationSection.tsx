import type { DelegationFlow } from '@goodboy/db';
import { SectionHeader, Skeleton } from '@goodboy/ui';
import type { ImpactWindowId } from '../../lib';
import { formatShare } from '../../utils/formatShare';
import { sharePercent } from '../../utils/sharePercent';
import { MetricCard } from './MetricCard';
import { WindowEmptyState } from './WindowEmptyState';

type Props = {
  readonly delegation: DelegationFlow | null;
  readonly windowId: ImpactWindowId;
};

const WORKFLOW_COACHING =
  'Many workflow runs get discarded. Trim steps that never change the outcome, or fix their prompts.';
const SPLIT_COACHING =
  'Long single-agent threads and no split work. Clusters run independent parts in parallel from one shared plan.';
const REVIEW_COACHING =
  'Most diff comments stay open. Resolve them here so the fix and the comment land together.';
const EXTERNAL_COACHING =
  'Integrations are connected but no session links to them. Starting from an issue hands the agent the ticket for free.';

export const DelegationSection = ({ delegation, windowId }: Props) => {
  if (delegation === null) {
    return (
      <section className="flex flex-col gap-3">
        <SectionHeader label="Delegation and flow" hint="How work gets handed off and closed out" />
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </section>
    );
  }

  const children = delegation.scoutChildren + delegation.clusterChildren;
  const discardShare = sharePercent({
    part: delegation.discardedRuns,
    total: delegation.workflowRuns,
  });
  const handledShare = sharePercent({
    part: delegation.diffCommentsHandled,
    total: delegation.diffCommentsTotal,
  });
  const openShare = handledShare == null ? null : 100 - handledShare;
  const isWindowEmpty = delegation.sessionCount === 0 && windowId === 'last30';
  const providerNames = delegation.external.map((entry) => entry.provider).join(', ');

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader label="Delegation and flow" hint="How work gets handed off and closed out" />
      {isWindowEmpty ? (
        <WindowEmptyState what="delegated work" />
      ) : (
        <div className="grid grid-cols-4 gap-3">
          <MetricCard
            label="workflow-driven"
            measure="Sessions with a workflow run that was not discarded, over every session active in the window"
            value={formatShare({
              part: delegation.workflowSessions,
              total: delegation.sessionCount,
            })}
            hint={`${delegation.workflowRuns} runs, ${delegation.discardedRuns} discarded`}
            coaching={
              delegation.workflowRuns >= 5 && discardShare != null && discardShare > 40
                ? WORKFLOW_COACHING
                : null
            }
          />
          <MetricCard
            label="split work"
            measure="Child agents grouped under a parent, separating scout fan-out from clusters"
            value={`${children}`}
            hint={`${delegation.scoutChildren} from scouts, ${delegation.clusterChildren} from clusters, ${delegation.completedGroups} groups finished`}
            coaching={children === 0 && delegation.longAgents >= 3 ? SPLIT_COACHING : null}
          />
          <MetricCard
            label="review handled here"
            measure="Diff comments resolved or consumed here, over every comment raised in the window"
            value={formatShare({
              part: delegation.diffCommentsHandled,
              total: delegation.diffCommentsTotal,
            })}
            hint={`${delegation.resolverAgents} resolver agents across ${delegation.resolvedThreads} threads`}
            coaching={
              delegation.diffCommentsTotal >= 10 && openShare != null && openShare > 70
                ? REVIEW_COACHING
                : null
            }
          />
          <MetricCard
            label="from external work"
            measure="Sessions linked to an issue, counted as started from it when the link lands within a minute of the session"
            value={formatShare({
              part: delegation.linkedSessions,
              total: delegation.sessionCount,
            })}
            hint={
              delegation.linkedSessions > 0
                ? `${delegation.startedFromSessions} started from an issue (${providerNames})`
                : `${delegation.integrationCount} integrations connected`
            }
            coaching={
              delegation.integrationCount > 0 && delegation.linkedSessions === 0
                ? EXTERNAL_COACHING
                : null
            }
          />
        </div>
      )}
    </section>
  );
};
