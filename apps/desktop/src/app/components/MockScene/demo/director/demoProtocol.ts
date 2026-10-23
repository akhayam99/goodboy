export const DEMO_PROTOCOL = { channel: 'goodboy-demo', version: 1 } as const;

export type DemoCommandType = 'play' | 'pause' | 'restart';

export type DemoCommand = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: DemoCommandType;
};

export type DemoReportType = 'ready' | 'progress' | 'complete' | 'hint';

export type DemoReport = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: DemoReportType;
  readonly elapsedMs: number;
  readonly durationMs: number;
  readonly cueIndex: number;
  readonly hint?: string;
};
