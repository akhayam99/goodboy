import { cn, tintClasses } from '@goodboy/ui';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runOpenQuestion } from '../../../../timeline/runOpenQuestion';
import { runWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { ORCHESTRATOR_DECIDING_SENTENCE } from '../../../../../workflows/orchestratorCopy';
import { TimelineRunChip } from './TimelineRunChip';

type Props = {
  readonly entry: TimelineRunEntry;
  readonly isDeciding?: boolean;
};

const questionSentenceOf = ({ entry }: { readonly entry: TimelineRunEntry }): string | null => {
  const open = runOpenQuestion({ entry });
  if (open == null) {
    return null;
  }
  return open.stepLabel == null
    ? 'Needs your answer'
    : `Needs your answer in step ${open.stepLabel}`;
};

export const TimelineRunLabel = ({ entry, isDeciding = false }: Props) => {
  const isDiscarded = entry.run.discardedAt != null;
  const questionSentence = questionSentenceOf({ entry });
  return (
    <>
      <TimelineRunChip
        kind={runWorkflowKind({ workflow: entry.workflow })}
        workflowName={entry.workflow.name}
        identity={entry.identity}
        muted={isDiscarded}
      />
      <span
        title={entry.workflow.name}
        className={cn(
          'min-w-0 truncate text-sm leading-5',
          isDiscarded ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {entry.workflow.name}
      </span>
      {questionSentence != null && (
        <span className={cn('shrink-0 text-2xs leading-4', tintClasses('warning').text)}>
          {questionSentence}
        </span>
      )}
      {isDeciding ? (
        <span className="min-w-0 truncate text-2xs text-muted-foreground">
          {ORCHESTRATOR_DECIDING_SENTENCE}
        </span>
      ) : null}
    </>
  );
};
