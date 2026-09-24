export type LauncherResumptionSupport = 'native' | 'none';

type Params = {
  readonly binary: string;
};

const launcherName = ({ binary }: Params): string => {
  const segments = binary.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? binary;
};

export const launcherResumptionSupport = ({ binary }: Params): LauncherResumptionSupport => {
  const name = launcherName({ binary });
  if (name === 'cursor-agent' || name === 'agy' || name === 'codex') {
    return 'none';
  }
  return 'native';
};
