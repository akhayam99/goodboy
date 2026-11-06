import type { LiveCheckWork } from './liveCheckWorkOf';

type Params = {
  readonly work: LiveCheckWork;
};

export const checkWorkReasonOf = ({ work }: Params): string => {
  const name = work.name ?? 'a failing check';
  return work.chain === 'fixing'
    ? `An Implementer is fixing ${name}`
    : `A Debugger is analyzing ${name}`;
};
