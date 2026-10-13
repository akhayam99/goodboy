type DiffParams = {
  readonly versionSubjects: ReadonlyArray<string>;
  readonly nowSubjects: ReadonlyArray<string>;
};

type VersionCommitDiff = {
  readonly added: number;
  readonly removed: number;
};

type CountParams = {
  readonly subjects: ReadonlyArray<string>;
};

const subjectCounts = ({ subjects }: CountParams): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const subject of subjects) {
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }
  return counts;
};

type MissingParams = {
  readonly from: ReadonlyArray<string>;
  readonly against: ReadonlyArray<string>;
};

const missingCount = ({ from, against }: MissingParams): number => {
  const available = subjectCounts({ subjects: against });
  let missing = 0;
  for (const subject of from) {
    const left = available.get(subject) ?? 0;
    if (left === 0) {
      missing += 1;
      continue;
    }
    available.set(subject, left - 1);
  }
  return missing;
};

export const versionCommitDiff = ({
  versionSubjects,
  nowSubjects,
}: DiffParams): VersionCommitDiff => ({
  added: missingCount({ from: nowSubjects, against: versionSubjects }),
  removed: missingCount({ from: versionSubjects, against: nowSubjects }),
});
