import { stringToBase64 } from '../../../../features/terminal/terminalDriver';

type SnapshotParams = {
  readonly lines: ReadonlyArray<string>;
};

type SnapshotAnswer = {
  readonly data: string;
  readonly offset: number;
  readonly exitCode: null;
};

export const terminalSnapshotAnswer = ({ lines }: SnapshotParams): SnapshotAnswer => ({
  data: stringToBase64({ value: lines.join('\r\n') }),
  offset: 0,
  exitCode: null,
});

type PayloadParams = {
  readonly payload: unknown;
};

export const terminalIdOf = ({ payload }: PayloadParams): string => {
  if (typeof payload !== 'object' || payload === null || !('sessionId' in payload)) {
    return '';
  }
  return typeof payload.sessionId === 'string' ? payload.sessionId : '';
};

type PromptParams = {
  readonly folder: string;
};

export const shellPromptLines = ({ folder }: PromptParams): ReadonlyArray<string> => [
  `\u001b[2m${folder}\u001b[0m`,
  '\u001b[32m%\u001b[0m ',
];

export const DEV_SERVER_PORT = 5173;

export const devServerLines: ReadonlyArray<string> = [
  '\u001b[32m%\u001b[0m pnpm dev',
  '',
  '  \u001b[1mvite\u001b[0m ready in 312 ms',
  '',
  `  Local:   http://localhost:${DEV_SERVER_PORT}/`,
  '  Network: use --host to expose',
];
