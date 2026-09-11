import type { SessionProjectMount } from '@goodboy/types';

type Params = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

export const recoverSoleMount = ({ mounts }: Params): SessionProjectMount | null =>
  mounts.length === 1 ? (mounts[0] ?? null) : null;
