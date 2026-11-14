export type FlowWord = 'Auto' | 'Lead';

type Params = {
  readonly isWork: boolean;
};

export const flowWordOf = ({ isWork }: Params): FlowWord => (isWork ? 'Lead' : 'Auto');
