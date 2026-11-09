import type { SessionId } from '@goodboy/types';

type Params = {
  readonly live: Readonly<Record<SessionId, Readonly<Record<string, string>>>>;
};

export const liveBrowserTabCount = ({ live }: Params): number =>
  Object.values(live).reduce((total, tabs) => total + Object.keys(tabs).length, 0);
