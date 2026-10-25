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

export type DemoRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type DemoHintsCommand = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: 'hints';
  readonly chapterId: string;
  readonly settledIds: ReadonlyArray<string>;
};

export type DemoRevealCommand = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: 'reveal';
  readonly hintId: string;
};

type DemoAnchorReport = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: 'anchor';
  readonly hintId: string | null;
  readonly rect: DemoRect | null;
  readonly isOffscreen: boolean;
  readonly isClicked?: boolean;
};

type DemoPlaceReport = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: 'place';
  readonly place: string;
};

type DemoTriedReport = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: 'tried';
  readonly hintId: string;
};

export type DemoHintReport = DemoAnchorReport | DemoTriedReport | DemoPlaceReport;

export type DemoTheme = 'dark' | 'light';

export type DemoThemeMessage = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: 'theme';
  readonly theme: DemoTheme;
};

export type DemoShortcutCode = 'KeyK' | 'KeyF' | 'KeyB';

export type DemoShortcutCommand = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: 'shortcut';
  readonly code: DemoShortcutCode;
};
