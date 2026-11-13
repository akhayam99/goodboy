export type BrowserLoad = {
  readonly url: string;
  readonly startedAt: number;
};

export type BrowserHostState = {
  readonly browserLoads: Readonly<Record<string, BrowserLoad>>;
  readonly browserFavicons: Readonly<Record<string, string | null>>;
};

export const browserHostInitialState: BrowserHostState = {
  browserLoads: {},
  browserFavicons: {},
};
