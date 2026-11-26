import { requestFactsOf } from './components/BrowserToolsDock/requestFactsOf';
import type { BrowserConsoleEntry } from './types';

type Params = {
  readonly entry: BrowserConsoleEntry;
};

export type RequestTimingRow = {
  readonly label: string;
  readonly value: string;
};

type MsParams = {
  readonly value: number;
};

const msOf = ({ value }: MsParams): string => `${Math.round(value)} ms`;

export const requestTimingOf = ({ entry }: Params): ReadonlyArray<RequestTimingRow> => {
  const facts = entry.network;
  if (facts === null) {
    return [];
  }
  const phases = facts.phases ?? null;
  return [
    { label: 'Started', value: `${msOf({ value: facts.start })} after the page started loading` },
    ...(phases === null
      ? []
      : [
          { label: 'Waiting', value: msOf({ value: phases.wait }) },
          { label: 'Download', value: msOf({ value: phases.download }) },
        ]),
    { label: 'Total', value: requestFactsOf({ entry }).time },
  ];
};
