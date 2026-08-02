import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';

type Params = {
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly runId: ProviderRunId;
  readonly at: IsoDateTime;
  readonly binary: string;
};

const REJECTED_FLAG_PATTERN = /^[\t ]*flags provided but not defined:[\t ]+(\S+)[\t ]*$/m;

export const cliExitEvents = ({
  exitCode,
  stderr,
  runId,
  at,
  binary,
}: Params): ReadonlyArray<TurnEvent> => {
  if (exitCode === 0 || exitCode === null) {
    return [];
  }
  const rejectedFlag = stderr.match(REJECTED_FLAG_PATTERN)?.[1];
  if (rejectedFlag != null) {
    return [
      {
        kind: 'error',
        runId,
        message: `The installed ${binary} CLI does not accept the ${rejectedFlag} flag.`,
        at,
      },
    ];
  }
  const firstStderrLine = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (firstStderrLine != null) {
    return [
      {
        kind: 'error',
        runId,
        message: `${binary} exited with code ${exitCode}: "${firstStderrLine}".`,
        at,
      },
    ];
  }
  return [
    {
      kind: 'error',
      runId,
      message: `${binary} exited with code ${exitCode}.`,
      at,
    },
  ];
};
