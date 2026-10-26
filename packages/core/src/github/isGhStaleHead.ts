const GH_STALE_HEAD_MARKERS: ReadonlyArray<string> = [
  'head branch was modified',
  'expected head sha',
];

type Params = {
  readonly stderr: string;
};

export const isGhStaleHead = ({ stderr }: Params): boolean => {
  const haystack = stderr.toLowerCase();
  return GH_STALE_HEAD_MARKERS.some((marker) => haystack.includes(marker));
};
