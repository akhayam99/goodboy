type Params = {
  readonly actionId: string;
  readonly title: string;
};

const FAILURE_VERB: Readonly<Record<string, string>> = {
  'artifact.runPlan': 'run',
  'artifact.runAgain': 'run',
  'artifact.restore': 'restore',
  'artifact.delete': 'delete',
  'artifact.deletePermanently': 'delete',
  'artifact.stop': 'stop',
  'artifact.retry': 'retry',
  'artifact.regenerate': 'regenerate',
};

const FALLBACK_VERB = 'update';

export const artifactFailureTitleOf = ({ actionId, title }: Params): string =>
  `Couldn't ${FAILURE_VERB[actionId] ?? FALLBACK_VERB} ${title}`;
