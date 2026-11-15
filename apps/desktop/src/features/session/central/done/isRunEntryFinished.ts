import { isWorkflowRunComplete } from '../../../workflows/isWorkflowRunComplete';
import type { TimelineRunEntry } from '../../timeline/buildTimelineGroups';
import { runAgentEntriesOf } from '../../timeline/runAgentEntriesOf';

type Params = {
  readonly entry: TimelineRunEntry;
};

export const isRunEntryFinished = ({ entry }: Params): boolean =>
  entry.run.discardedAt != null ||
  isWorkflowRunComplete({
    run: entry.run,
    workflow: entry.workflow,
    agents: runAgentEntriesOf({ entry }).map((child) => child.agent),
  });
