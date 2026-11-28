export type SettleRequestState = 'open' | 'merged' | 'closed' | 'unknown';

export type SettleRequest = Readonly<{
  state: SettleRequestState;
  mergedAt: number | null;
}>;

export type SettleThread = Readonly<{
  state: string;
}>;

export type SettleParams = {
  readonly requests: ReadonlyArray<SettleRequest>;
  readonly threads: ReadonlyArray<SettleThread>;
};
