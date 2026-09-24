import { WORK_NODE_GLYPH_SIZE, WorkNode, tintClasses } from '@goodboy/ui';
import type { WorkflowOrchestrationOutcome } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { TimelineRowMarker } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineRowMarker';
import type { TimelineRowItem } from '../../../session/timeline/buildTimelineStream';

type Props = {
  readonly item: TimelineRowItem | null;
  readonly outcome: WorkflowOrchestrationOutcome | null;
};

const OUTCOME_TONE = {
  done: 'success',
  blocked: 'warning',
} as const satisfies Record<WorkflowOrchestrationOutcome, 'success' | 'warning'>;

export const WorkflowDecisionNode = ({ item, outcome }: Props) => {
  if (item !== null) {
    return <TimelineRowMarker item={item} />;
  }
  if (outcome !== null) {
    const tone = OUTCOME_TONE[outcome];
    return (
      <WorkNode
        state="marker"
        tone={tone}
        label={outcome === 'done' ? 'Run complete' : 'Stopped'}
        mark={{
          kind: 'glyph',
          glyph: (
            <CONCEPT_ICONS.orchestrator
              size={WORK_NODE_GLYPH_SIZE}
              strokeWidth={2}
              className={tintClasses(tone).icon}
            />
          ),
        }}
      />
    );
  }
  return <WorkNode state="queued" label="Not started" mark={{ kind: 'dot' }} />;
};
