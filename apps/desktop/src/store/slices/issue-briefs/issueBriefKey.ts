import type { IssueBriefSource } from './types';

type Params = {
  readonly sources: ReadonlyArray<Pick<IssueBriefSource, 'provider' | 'externalId' | 'identifier'>>;
};

export const issueBriefKey = ({ sources }: Params): string => {
  const sorted = [...sources].sort(
    (left, right) =>
      left.identifier.localeCompare(right.identifier) ||
      left.provider.localeCompare(right.provider) ||
      left.externalId.localeCompare(right.externalId),
  );
  const single = sorted.length === 1 ? sorted[0] : undefined;
  if (single !== undefined) {
    return `${single.provider}:${single.externalId}`;
  }
  return JSON.stringify(
    sorted.map(({ provider, externalId, identifier }) => [provider, externalId, identifier]),
  );
};
