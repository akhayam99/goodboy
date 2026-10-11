import type { WatchedPort } from '@goodboy/core';

type Params = {
  readonly scanned: ReadonlyArray<WatchedPort> | undefined;
  readonly scriptName: string;
};

export const expectedPort = ({ scanned, scriptName }: Params): number | null => {
  const byScript = scanned?.find(
    (entry) => entry.source === 'script' && entry.label === scriptName,
  );
  return byScript?.port ?? null;
};
