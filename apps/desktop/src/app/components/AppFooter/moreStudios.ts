export type MoreStudioId = 'impact' | 'changelog';

export type MoreStudioEntry = {
  readonly id: MoreStudioId;
  readonly label: string;
  readonly title: string;
};

export const MORE_STUDIOS: ReadonlyArray<MoreStudioEntry> = [
  {
    id: 'impact',
    label: 'Impact',
    title: 'See how orchestration changed the way this workspace works, and what it spends',
  },
  { id: 'changelog', label: 'Changelog', title: 'See what changed, release by release' },
];
