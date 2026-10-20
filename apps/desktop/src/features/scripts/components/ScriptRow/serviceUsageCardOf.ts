import type { FactCardSpec } from '@goodboy/ui';
import { formatBytes } from '../../../../shared/utils/formatBytes';

type Params = {
  readonly name: string;
  readonly facts: { readonly cpuPercent: number; readonly rssBytes: number } | null;
  readonly isRunning: boolean;
};

export const serviceUsageCardOf = ({ name, facts, isRunning }: Params): FactCardSpec | null => {
  if (!isRunning || facts === null) {
    return null;
  }
  return {
    title: name,
    state: { tone: 'info', words: 'Running', isRunning: true },
    facts: [
      { label: 'CPU', value: `${Math.round(facts.cpuPercent)}%` },
      { label: 'Memory', value: formatBytes({ bytes: facts.rssBytes }) },
    ],
  };
};
