import type { IssueBriefSource } from './types';

type Params = {
  readonly source: Pick<IssueBriefSource, 'provider' | 'externalId'>;
};

export const issueBriefKey = ({ source }: Params): string =>
  `${source.provider}:${source.externalId}`;
