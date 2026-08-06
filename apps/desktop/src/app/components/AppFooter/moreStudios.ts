export type MoreStudioId = 'budget' | 'impact' | 'changelog';

export type MoreStudioEntry = {
  readonly id: MoreStudioId;
  readonly label: string;
  readonly title: string;
};

export const MORE_STUDIOS: ReadonlyArray<MoreStudioEntry> = [
  { id: 'budget', label: 'Budget', title: 'Open budget studio' },
  {
    id: 'impact',
    label: 'Impact',
    title: 'See how orchestration changed the way this workspace works',
  },
  { id: 'changelog', label: 'Changelog', title: 'See what changed, release by release' },
];
