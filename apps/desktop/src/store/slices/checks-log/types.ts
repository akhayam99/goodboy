export type CheckLogReading = {
  readonly detailsUrl: string;
  readonly status: 'ready' | 'none';
  readonly fetchedAt: string;
  readonly testFile: string | null;
  readonly testName: string | null;
  readonly isTimeout: boolean;
  readonly lines: ReadonlyArray<string>;
};

export type CheckLogsMap = Readonly<Record<string, CheckLogReading>>;
