import { NAMES } from '../names';

type IdentifierParams = {
  readonly identifier: string;
};

export const startFromLabel = ({ identifier }: IdentifierParams): string =>
  `${NAMES.start} from ${identifier}`;

export const pickLabel = ({ identifier }: IdentifierParams): string => `Pick ${identifier}`;

export const WORKFLOW_CHOICE_LINE = 'Orchestrated, steps you describe, or a saved workflow.';

export const reviewPullRequestLabel = ({ identifier }: IdentifierParams): string =>
  `${NAMES.reviewPullRequest} ${identifier}`;
