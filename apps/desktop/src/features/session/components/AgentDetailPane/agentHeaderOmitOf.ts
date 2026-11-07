const STOP_VERB = 'agent.stop';

const PLAIN_OMIT: ReadonlyArray<string> = [STOP_VERB, 'agent.model'];

const AUTO_OMIT: ReadonlyArray<string> = [
  STOP_VERB,
  'agent.changes',
  'agent.model',
  'agent.copyName',
];

type Params = {
  readonly isAutoRoot: boolean;
};

export const agentHeaderOmitOf = ({ isAutoRoot }: Params): ReadonlyArray<string> =>
  isAutoRoot ? AUTO_OMIT : PLAIN_OMIT;
