import { Clock } from 'lucide-react';
import { tintClasses } from '@goodboy/ui';
import type { AgentStatus } from '@goodboy/types';
import { resolveMarkerState } from '../../../session/timeline/markerState';
import { TIMELINE_RHYTHM } from '../../../session/timeline/timelineRhythm';
import { TimelineDashedMarker } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineDashedMarker';
import { TimelineMarker } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineMarker';
import { STEP_ROW_GRADE } from './stepGraphRows';

type Props = {
  readonly status: AgentStatus;
  readonly hasOpenQuestion: boolean;
};

export const WorkflowStepRailMarker = ({ status, hasOpenQuestion }: Props) => {
  if (status === 'pending' && !hasOpenQuestion) {
    return (
      <TimelineDashedMarker tone="neutral" grade={STEP_ROW_GRADE}>
        <Clock
          size={TIMELINE_RHYTHM.grade[STEP_ROW_GRADE].glyphSize}
          aria-label="Not started"
          className={tintClasses('neutral').icon}
        />
      </TimelineDashedMarker>
    );
  }
  return (
    <TimelineMarker
      state={resolveMarkerState({ status, hasOpenQuestion, needsUser: false })}
      grade={STEP_ROW_GRADE}
    />
  );
};
