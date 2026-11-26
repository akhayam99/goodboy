import type { ProjectionMeta } from '../contract/projections';

type Params = {
  readonly epoch: number;
  readonly seq: number;
  readonly now: number;
};

export const projectionMetaOf = ({ epoch, seq, now }: Params): ProjectionMeta => ({
  epoch,
  seq,
  generatedAt: new Date(now).toISOString(),
});
