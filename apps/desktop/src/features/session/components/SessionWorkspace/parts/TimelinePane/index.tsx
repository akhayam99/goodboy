import { useMemo } from 'react';
import { Divider, LensEmptyState, ScrollFade } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useIsSessionCollectionLoaded,
  useSessionOpenQuestions,
} from '../../../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { useAttachedWorkflowRuns } from '../../../../../workflows/useAttachedWorkflowRuns';
import { WorkflowAttachButton } from '../../../../../workflows/components/WorkflowAttachButton';
import { useAgentMetrics } from '../../../../hooks/useAgentMetrics';
import { buildTimelineEntries } from '../../../../timeline/buildTimelineEntries';
import { TimelineAgentRow } from './TimelineAgentRow';
import { TimelineBand } from './TimelineBand';
import { TimelineQuestionInset } from './TimelineQuestionInset';
import { TimelineSkeleton } from './TimelineSkeleton';

type Props = {
  readonly session: Session;
};

const dateLabel = ({ at }: { readonly at: string }): string =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(at));

export const TimelinePane = ({ session }: Props) => {
  const sessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const plans = useAppStore((s) => s.sessionPlans[sessionId] ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const questions = useSessionOpenQuestions(sessionId);
  const workflows = useAttachedWorkflowRuns({ session });
  const areAgentsLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'agents' });
  const metrics = useAgentMetrics({ sessionId });
  const entries = useMemo(
    () =>
      buildTimelineEntries({
        agents,
        workflows,
        plans,
        externalTasks,
        questions,
        agentKindOverride,
      }),
    [agentKindOverride, agents, externalTasks, plans, questions, workflows],
  );

  if (!areAgentsLoaded) {
    return <TimelineSkeleton />;
  }

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <LensEmptyState
          icon={CONCEPT_ICONS.timeline}
          tone={CONCEPT_TONE.timeline}
          title="Nothing has run yet"
          description="Every step, agent and resolve this session runs lands here in order, with what it produced."
          action={<WorkflowAttachButton sessionId={sessionId} placement="inline" />}
        />
      </div>
    );
  }

  let previousDate = '';
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollFade className="min-h-0 flex-1" viewportClassName="flex flex-col gap-px p-4">
        {entries.map((entry) => {
          const currentDate = dateLabel({ at: entry.at });
          const showsDate = currentDate !== previousDate;
          previousDate = currentDate;
          const dateRule = showsDate ? (
            <div className="flex items-center gap-2 py-1 text-3xs uppercase text-muted-foreground">
              <Divider />
              <span className="shrink-0">{currentDate}</span>
              <Divider />
            </div>
          ) : null;
          if (entry.kind === 'agent') {
            const aggregate = metrics.aggregatesByAgentId.get(entry.agent.id) ?? null;
            const estimatedCostUsd =
              aggregate != null && aggregate.turns > 0 ? aggregate.estimatedCostUsd : null;
            return (
              <div key={entry.id} className="flex flex-col gap-px">
                {dateRule}
                <TimelineAgentRow
                  entry={entry}
                  sessionId={sessionId}
                  estimatedCostUsd={estimatedCostUsd}
                />
              </div>
            );
          }
          if (entry.kind === 'question') {
            return (
              <div key={entry.id} className="flex flex-col gap-px">
                {dateRule}
                <TimelineQuestionInset question={entry.question} sessionId={sessionId} />
              </div>
            );
          }
          return (
            <div key={entry.id} className="flex flex-col gap-px">
              {dateRule}
              <TimelineBand entry={entry} sessionId={sessionId} />
            </div>
          );
        })}
      </ScrollFade>
    </div>
  );
};
