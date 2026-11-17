import type { MountId } from '@goodboy/types';

export type StartRunSources = Readonly<{
  threadIds: ReadonlyArray<string>;
  mountId: MountId | null;
  quote: string;
}>;
