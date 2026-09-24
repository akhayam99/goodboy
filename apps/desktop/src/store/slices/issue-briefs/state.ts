import type { IssueBriefEntry } from './types';

export type IssueBriefsState = {
  readonly issueBriefs: Readonly<Record<string, IssueBriefEntry>>;
};

export const issueBriefsInitialState: IssueBriefsState = {
  issueBriefs: {},
};
