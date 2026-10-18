import { NAMES } from '../names';

type IdentifierParams = {
  readonly identifier: string;
};

export const startFromLabel = ({ identifier }: IdentifierParams): string =>
  `${NAMES.start} from ${identifier}`;

const pickLabel = ({ identifier }: IdentifierParams): string => `Pick ${identifier}`;

export const TASK_CHOICE = 'Pick up a task';
export const RUN_WORKFLOW_CHOICE = NAMES.startRun;
export const RUN_ORCHESTRATOR_CHOICE = NAMES.startOrchestrator;
export const START_AGENT_CHOICE = NAMES.startAgent;
export const START_AUTO_CHOICE = NAMES.startAuto;
export const WRITE_REPORT_CHOICE = 'Write a report';
export const DRAW_WIREFRAME_CHOICE = 'Draw a wireframe';

type RoleParams = {
  readonly noun: string;
};

export const startRoleLabel = ({ noun }: RoleParams): string => `${NAMES.start} ${noun}`;

export const TASK_LINE = 'Start from an issue in your tracker.';
export const RUN_LINE = 'Several agents work through your goal, step by step.';
export const ORCHESTRATE_LINE = 'The orchestrator picks each next step until the goal is done.';
export const AGENT_LINE = 'One agent in the role you pick.';
export const AUTO_AGENT_LINE = 'Auto answers, or hands the work to the roles it picks.';

export const reviewPullRequestLabel = ({ identifier }: IdentifierParams): string =>
  `${NAMES.reviewPullRequest} ${identifier}`;

type IdentifiersParams = {
  readonly identifiers: ReadonlyArray<string>;
};

const namedWithMore = ({ identifiers }: IdentifiersParams): string => {
  const [first = '', ...rest] = identifiers;
  return rest.length === 0 ? first : `${first} and ${rest.length} more`;
};

export const startFromIssuesLabel = ({ identifiers }: IdentifiersParams): string =>
  `${NAMES.start} from ${namedWithMore({ identifiers })}`;

export const pickIssuesLabel = ({ identifiers }: IdentifiersParams): string =>
  identifiers.length === 1
    ? pickLabel({ identifier: identifiers[0] ?? '' })
    : `Pick ${identifiers.length} issues`;

export const willCloseLine = ({ identifiers }: IdentifiersParams): string | null =>
  identifiers.length === 0 ? null : `Will close ${identifiers.join(', ')} when merged`;

export const ISSUE_CAP_LINE = 'Up to 5 issues start one session';
