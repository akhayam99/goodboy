import { ExploreScene } from '../audit/ExploreScene';

const OPEN_CHANGES: ReadonlyArray<string> = ['src', 'settlement'];
const FILTER_CHANGED: ReadonlyArray<string> = ['Changed'];
const EMPTY_FILTER: ReadonlyArray<string> = ['Changed', 'Refresh the files'];
const DRAWER_CHANGES: ReadonlyArray<string> = ['src', 'settlement', 'rounding.ts', 'Changes'];

export const U24_EXPLORE_CHANGES_SCENES = {
  'explore-changes': () => <ExploreScene changes="some" openLabels={OPEN_CHANGES} />,
  'explore-changedfilter': () => <ExploreScene changes="some" openLabels={FILTER_CHANGED} />,
  'explore-changedempty': () => <ExploreScene changes="clears" openLabels={EMPTY_FILTER} />,
  'explore-drawerchanges': () => <ExploreScene changes="some" openLabels={DRAWER_CHANGES} />,
};
