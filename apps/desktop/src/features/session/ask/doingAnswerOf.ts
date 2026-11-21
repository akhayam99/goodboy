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

const MAX_RUNS = 4;

const runsTextOf = ({ runs }: Pick<Params, 'runs'>): string => {
  if (runs.length === 0) {
    return 'Nothing is running in this session.';
  }
  const shown = runs.slice(0, MAX_RUNS).map((run) => `${run.agent}: ${run.phrase}.`);
  const rest = runs.length - MAX_RUNS;
  return rest > 0
    ? [
        ...shown,
        `${countNoun({ count: rest, one: 'more agent', many: 'more agents' })} working.`,
      ].join(' ')
    : shown.join(' ');
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
