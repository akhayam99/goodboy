import type { WorkRow } from './workRowsOf';

type Params = {
  readonly row: WorkRow;
};

export const workAgentsTextOf = ({ row }: Params): string => {
  if (row.agentsRunning > 0) {
    return `${row.agentsRunning} running`;
  }
  return row.lead.stop === 'finished' || row.lead.stop === 'stopped' ? '' : 'idle';
};
