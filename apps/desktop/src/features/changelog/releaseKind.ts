export type ReleaseKind = 'patch' | 'minor' | 'major';

type Params = {
  readonly version: string;
};

const numberAt = ({
  version,
  index,
}: {
  readonly version: string;
  readonly index: number;
}): number => {
  const raw = version.split('.')[index];
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const releaseKindOf = ({ version }: Params): ReleaseKind => {
  const patch = numberAt({ version, index: 2 });
  if (patch !== 0) {
    return 'patch';
  }
  const minor = numberAt({ version, index: 1 });
  const major = numberAt({ version, index: 0 });
  if (minor === 0 && major !== 0) {
    return 'major';
  }
  return 'minor';
};
