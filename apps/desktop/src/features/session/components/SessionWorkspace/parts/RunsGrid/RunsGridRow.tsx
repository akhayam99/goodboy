import type { Agent, OpenQuestion, Workflow, WorkflowRun } from '@goodboy/types';
import { ListGridRow, StateDot, formatUsd } from '@goodboy/ui';
import { formatAge } from '../../../../../../shared/utils/time/formatAge';
import { runRowFactsOf } from '../../../../../workflows/runRowFactsOf';

type Props = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly name: string;
  readonly agents: ReadonlyArray<Agent>;
  readonly costUsd: number | null;
  readonly predecessorName: string;
  readonly isOrchestrating: boolean;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly now: number;
  readonly onOpen: () => void;
};

export const RunsGridRow = ({
  run,
  workflow,
  name,
  agents,
  costUsd,
  predecessorName,
  isOrchestrating,
  questions,
  now,
  onOpen,
}: Props) => {
  const facts = runRowFactsOf({
    run,
    workflow,
    agents,
    predecessorName,
    isOrchestrating,
    questions,
  });
  return (
    <ListGridRow
      ariaLabel={`Open ${name}, ${facts.word}`}
      onSelect={onOpen}
      cells={[
        <StateDot state={facts.dot} label={facts.word} isLive />,
        name,
        facts.word,
        facts.progress,
        costUsd === null ? '' : formatUsd(costUsd),
        run.createdAt == null ? '' : formatAge({ from: run.createdAt, now }),
      ]}
    />
  );
};
