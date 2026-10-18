import { isSafeVerdict, type ClassifiedBranch } from './classifyBranch';

type Params = {
  readonly entries: ReadonlyArray<ClassifiedBranch>;
};

export const branchesMetaOf = ({ entries }: Params): string => {
  const safeCount = entries.filter((entry) => isSafeVerdict(entry.verdict)).length;
  const lookCount = entries.filter((entry) => entry.verdict === 'needs-look').length;
  const safe = `${safeCount} safe to delete`;
  return lookCount === 0 ? safe : `${safe} · ${lookCount} need a look`;
};
