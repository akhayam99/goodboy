import type { WatchedPort } from '@goodboy/core';

type Params = {
  readonly scanned: ReadonlyArray<WatchedPort> | undefined;
  readonly scriptName: string;
  readonly relDir: string;
};

export const expectedPort = ({ scanned, scriptName, relDir }: Params): number | null => {
  const byScript = scanned?.find(
    (entry) => entry.source === 'script' && entry.label === scriptName && entry.relDir === relDir,
  );
  return byScript?.port ?? null;
};
