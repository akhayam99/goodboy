import type { ReleaseEntry } from '../changelog/parseChangelog';

export type ArrivalBullet = {
  readonly title: string;
};

export const arrivalTitle = ({ version }: { readonly version: string | null }): string =>
  `Goodboy ${version ?? 'update'} is ready`;

type ArrivalBulletsParams = {
  readonly notes: ReleaseEntry | null;
};

export const arrivalBullets = ({ notes }: ArrivalBulletsParams): ReadonlyArray<ArrivalBullet> => {
  if (notes === null || notes.shape !== 'v2') {
    return [];
  }
  const titles = [
    ...notes.sections.new.map((feature) => feature.title),
    ...notes.sections.improved.map((feature) => feature.title),
  ];
  return titles.slice(0, 3).map((title) => ({ title }));
};

export const arrivalLead = ({ notes }: { readonly notes: ReleaseEntry | null }): string | null => {
  if (notes === null || notes.shape !== 'v2') {
    return null;
  }
  return notes.lead;
};
