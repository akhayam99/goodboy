import type { AgentId } from '@goodboy/types';
import type { BranchWorkCounts } from '../branch/branchTabFactsOf';
import { branchGroupShownCountOf, type BranchGroup } from './branchGroupsOf';
import { runGroupKeyOf } from './runGroupsOf';
import { questionGroupCountOf } from './components/SessionWorkspace/parts/QuestionsGrid/questionRowKeys';
import type { QuestionBranchGroup } from './components/SessionWorkspace/parts/questionsLensModel';

type ArtifactCounts = Readonly<{
  count: number;
  needsYouAgentIds: ReadonlyArray<AgentId | null>;
}>;

type Params = {
  readonly runs: BranchGroup | null;
  readonly questions: QuestionBranchGroup | null;
  readonly artifacts: ArtifactCounts;
};

type RunsParams = {
  readonly runs: BranchGroup | null;
};

const agentsOfRunsThatNeedYou = ({ runs }: RunsParams): ReadonlySet<AgentId> =>
  new Set(
    (runs?.runs ?? [])
      .filter((run) => runGroupKeyOf({ run }) === 'needsYou')
      .flatMap((run) => run.agentIds),
  );

export const branchWorkCountsOf = ({ runs, questions, artifacts }: Params): BranchWorkCounts => {
  const heldByRuns = agentsOfRunsThatNeedYou({ runs });
  const waiting = (questions?.waiting ?? []).filter((item) => {
    const askerId = item.row.question.createdByAgentId;
    return askerId === undefined || !heldByRuns.has(askerId);
  });
  const held = new Set<AgentId>([
    ...heldByRuns,
    ...(questions?.waiting ?? []).flatMap((item) => {
      const askerId = item.row.question.createdByAgentId;
      return askerId === undefined ? [] : [askerId];
    }),
  ]);
  const artifactsNeedYou = artifacts.needsYouAgentIds.filter(
    (agentId) => agentId === null || !held.has(agentId),
  );
  return {
    runs: runs === null ? 0 : branchGroupShownCountOf({ group: runs }),
    runsNeedYou: runs === null ? 0 : runs.counts.needsYou,
    running: runs === null ? 0 : runs.counts.running,
    questions: questions === null ? 0 : questionGroupCountOf({ group: questions }),
    waiting: waiting.length,
    artifacts: artifacts.count,
    artifactsNeedYou: artifactsNeedYou.length,
  };
};
