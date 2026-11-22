import type { AgentId } from '@goodboy/types';
import { countNoun } from '../../../shared/utils/countNoun';
import type { AskSessionAnswer } from './AskSessionAnswer';

export type DoingRun = Readonly<{
  agentId: AgentId | null;
  agent: string;
  phrase: string;
}>;

export type DoingBranch = Readonly<{
  project: string;
  branch: string;
  word: string;
}>;

type Params = Readonly<{
  runs: ReadonlyArray<DoingRun>;
  branches: ReadonlyArray<DoingBranch>;
}>;

const runsTextOf = ({ runs }: Pick<Params, 'runs'>): string => {
  if (runs.length === 0) {
    return 'Nothing is running in this session.';
  }
  return runs.map((run) => `${run.agent}: ${run.phrase}.`).join(' ');
};

export const doingAnswerOf = ({ runs, branches }: Params): AskSessionAnswer => {
  const branchText = branches.map(
    (branch) => `${branch.project} on ${branch.branch}: ${branch.word}.`,
  );
  return {
    text: [runsTextOf({ runs }), ...branchText].join(' '),
    sources: [
      ...(runs.length === 0
        ? []
        : [`Live work, ${countNoun({ count: runs.length, one: 'agent' })}`]),
      ...branches.map((branch) => `Branch ${branch.branch}`),
    ],
    agentId: runs.find((run) => run.agentId !== null)?.agentId ?? null,
  };
};
