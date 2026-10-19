import type { Session } from '@goodboy/types';
import { AutoLimitFoot } from '../../../features/auto/AutoLimitFoot';
import { useAutoTreeRows } from '../../../features/auto/useAutoTreeRows';
import type { SpawnedFocus } from './spawnedFocus';
import { RunSpendFoot } from './RunSpendFoot';

type Props = {
  readonly session: Session;
  readonly focus: SpawnedFocus;
};

export const SpawnedFocusFoot = ({ session, focus }: Props) => {
  const run =
    focus.kind === 'run'
      ? (session.workflowRuns.find((candidate) => candidate.id === focus.runId) ?? null)
      : null;
  const auto = useAutoTreeRows({
    sessionId: session.id,
    agentId: focus.kind === 'auto' ? focus.rootAgentId : null,
  });
  const view = auto.tree?.view ?? null;
  if (run !== null) {
    return <RunSpendFoot sessionId={session.id} run={run} />;
  }
  if (view === null || view.budget === null) {
    return null;
  }
  return <AutoLimitFoot sessionId={session.id} treeId={view.tree.id} facts={view.budget} />;
};
