import type { ReleaseEntry } from './parseChangelog';

export const PR_URL = ({ number }: { readonly number: number }): string =>
  `https://github.com/akhayam99/goodboy/pull/${number}`;

export const uniquePrs = ({
  release,
}: {
  readonly release: ReleaseEntry;
}): ReadonlyArray<number> => {
  if (release.shape !== 'v2') {
    return [];
  }
  const all = [
    ...release.sections.new.flatMap((feature) => feature.prs),
    ...release.sections.improved.flatMap((feature) => feature.prs),
    ...release.sections.fixed.flatMap((fix) => fix.prs),
  ];
  return Array.from(new Set(all));
};
