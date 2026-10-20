export type OverviewLayout = 'classic' | 'new';

type Params = {
  readonly raw: string | null | undefined;
};

export const overviewLayoutOf = ({ raw }: Params): OverviewLayout =>
  raw === 'new' ? 'new' : 'classic';
