import type { Session } from '@goodboy/types';
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
  if (run === null) {
    return null;
  }
  return <RunSpendFoot sessionId={session.id} run={run} />;
};
