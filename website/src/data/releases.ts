import { compareVersions } from './compareVersions';

export type Feature = {
  readonly id: string;
  readonly title: string;
  readonly copy: string;
  readonly isNew: boolean;
};

export type Group = {
  readonly id: string;
  readonly title: string;
  readonly features: readonly Feature[];
};

type NewItem = {
  readonly title: string;
  readonly copy: string;
};

export type Snapshot = {
  readonly version: string;
  readonly summary: string;
  readonly new: readonly NewItem[];
  readonly groups: readonly Group[];
};

export const SNAPSHOTS: readonly Snapshot[] = Object.values(
  import.meta.glob<Snapshot>('./releases/*.json', { eager: true, import: 'default' }),
).sort((left, right) => compareVersions({ left: left.version, right: right.version }));
