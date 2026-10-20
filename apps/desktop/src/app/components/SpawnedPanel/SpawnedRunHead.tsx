import { StateDot } from '@goodboy/ui';
import type { Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useSessionOpenQuestions } from '../../../store';
import { useRunView } from '../../../features/session/components/AgentTree/useRunView';
import { runRowFactsOf } from '../../../features/workflows/runRowFactsOf';
import { openSpawned } from '../../../features/session/openSpawned';
import type { RailRow } from '../../../features/workTreeModel/railGeometry';
import { ObjectMenuArea } from '../../../features/actions/components/ObjectMenuArea';
import { SpawnedTreeRow } from './SpawnedTreeRow';
import { runHeadCardOf } from './runHeadCardOf';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly hasChildren: boolean;
  readonly rail: RailRow;
  readonly railWidth: number;
};

export const SpawnedRunHead = ({ session, run, workflow, hasChildren, rail, railWidth }: Props) => {
  const view = useRunView({ session, run, workflow });
  const questions = useSessionOpenQuestions(session.id);
  const facts = runRowFactsOf({
    run,
    workflow,
    agents: view.agents,
    predecessorName: view.predecessorName,
    isOrchestrating: view.isOrchestrating,
    questions,
  });
  return (
    <ObjectMenuArea
      target={{ kind: 'workflowRun', sessionId: session.id, runId: run.id }}
      anchorKey={`spawned:run:${run.id}`}
    >
      <SpawnedTreeRow
        id={`run:${run.id}`}
        level={1}
        hasChildren={hasChildren}
        rail={rail}
        railWidth={railWidth}
        glyph={<StateDot state={facts.dot} label={facts.word} />}
        role={null}
        title={view.name}
        card={runHeadCardOf({ name: view.name, dot: facts.dot, word: facts.word })}
        word={facts.word}
        time={null}
        isSelected={false}
        onOpen={() =>
          openSpawned({ sessionId: session.id, target: { kind: 'run', runId: run.id } })
        }
      />
    </ObjectMenuArea>
  );
};
