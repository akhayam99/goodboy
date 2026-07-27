import type { ContextHealth, PlanAdoption } from '@goodboy/db';
import { SectionHeader, Skeleton, StatusDot } from '@goodboy/ui';
import type { ImpactWindowId } from '../../lib';
import { formatShare } from '../../utils/formatShare';
import { sharePercent } from '../../utils/sharePercent';
import { MetricCard } from './MetricCard';
import { MetricRow } from './MetricRow';
import { StackedBar } from './StackedBar';
import { WindowEmptyState } from './WindowEmptyState';

type Props = {
  readonly plan: PlanAdoption | null;
  readonly context: ContextHealth | null;
  readonly windowId: ImpactWindowId;
};

const PLANNED_COACHING =
  'Most sessions run without a consumed plan. A plan gives every agent the same brief and cuts rework.';
const HANDOFF_COACHING =
  'Plans are only consumed by their author. Hand the plan to a fresh implementer so it starts with clean context.';
const SLOT_COACHING =
  'Agents in most sessions start with no pinned context. Fill context slots so every agent reads the same state.';
const QUESTION_COACHING =
  'Most agent questions get dismissed. Unanswered questions push agents to guess, so answer them or tune the steps to ask fewer.';

export const PlanSection = ({ plan, context, windowId }: Props) => {
  const plannedShare =
    plan === null ? null : sharePercent({ part: plan.plannedSessions, total: plan.sessionCount });
  const slotShare =
    context === null
      ? null
      : sharePercent({ part: context.slotSessions, total: context.sessionCount });
  const settled = context === null ? 0 : context.questionsAnswered + context.questionsDismissed;
  const dismissedShare =
    context === null ? null : sharePercent({ part: context.questionsDismissed, total: settled });
  const answeredShare =
    context === null ? null : sharePercent({ part: context.questionsAnswered, total: settled });
  const authorEdits = context === null ? 0 : context.userEdits + context.summarizerEdits;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        label="Plan and context"
        hint="How much shared brief every agent starts from"
      />
      {plan === null ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : plan.sessionCount === 0 && windowId === 'last30' ? (
        <WindowEmptyState what="planning activity" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="planned sessions"
            measure="Sessions where an agent consumed a plan, over every session active in the window"
            value={formatShare({ part: plan.plannedSessions, total: plan.sessionCount })}
            hint={`${plan.plannedSessions} of ${plan.sessionCount} sessions, ${plan.consumedPlans} plans consumed`}
            coaching={
              plan.sessionCount >= 5 && plannedShare != null && plannedShare < 30
                ? PLANNED_COACHING
                : null
            }
          />
          <MetricCard
            label="plan handoffs"
            measure="Consumed plans picked up by an agent other than the one that wrote them"
            value={formatShare({ part: plan.handoffPlans, total: plan.consumedPlans })}
            hint={`${plan.handoffPlans} of ${plan.consumedPlans} plans, across ${plan.handoffSessions} sessions`}
            coaching={plan.consumedPlans >= 5 && plan.handoffPlans === 0 ? HANDOFF_COACHING : null}
          />
        </div>
      )}
      {context === null ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <MetricRow
            label="context slot coverage"
            measure="Sessions with at least one enabled context slot, over every session active in the window"
            value={formatShare({ part: context.slotSessions, total: context.sessionCount })}
            hint={
              authorEdits > 0
                ? `${context.userEdits} edits by you, ${context.summarizerEdits} by the summarizer`
                : 'No slot edits recorded yet'
            }
            coaching={
              context.sessionCount >= 5 && slotShare != null && slotShare < 25
                ? SLOT_COACHING
                : null
            }
          >
            <StackedBar
              segments={[
                {
                  key: 'user',
                  tone: 'primary',
                  share: sharePercent({ part: context.userEdits, total: authorEdits }) ?? 0,
                  title: `${context.userEdits} slot edits by you`,
                },
                {
                  key: 'summarizer',
                  tone: 'info',
                  share: sharePercent({ part: context.summarizerEdits, total: authorEdits }) ?? 0,
                  title: `${context.summarizerEdits} slot edits by the summarizer`,
                },
              ]}
            />
          </MetricRow>
          <MetricRow
            label="questions answered"
            measure="Agent questions you answered, over the questions that reached an answer or a dismissal"
            value={
              settled > 0
                ? formatShare({ part: context.questionsAnswered, total: settled })
                : 'No questions yet'
            }
            hint={
              context.avgHoursToAnswer != null
                ? `${context.questionsAnswered} answered, ${context.questionsDismissed} dismissed, ${context.avgHoursToAnswer.toFixed(1)}h average wait`
                : `${context.questionsTotal} asked, none answered yet`
            }
            leading={
              <StatusDot
                tone={
                  answeredShare == null ? 'neutral' : answeredShare >= 60 ? 'success' : 'warning'
                }
              />
            }
            coaching={
              settled >= 5 && dismissedShare != null && dismissedShare > 40
                ? QUESTION_COACHING
                : null
            }
          />
        </div>
      )}
    </section>
  );
};
