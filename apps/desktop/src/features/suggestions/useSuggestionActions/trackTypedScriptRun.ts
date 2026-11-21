import type { MountId, SessionId } from '@goodboy/types';
import { startPoll } from '../../../shared/lib/usePoll/startPoll';
import { isBusyTerminal } from '../../terminal/isBusyTerminal';
import type { LiveTerminal } from '../../terminal/terminal';

const POLL_MS = 2_000;
const MAX_FOLLOW_MS = 30 * 60 * 1_000;
const MAX_READ_FAILURES = 3;

type RecordParams = {
  readonly sessionId: SessionId;
  readonly scriptId: string;
  readonly name: string;
  readonly mountId: MountId;
  readonly exitCode: number;
  readonly startedAt: number;
};

type FailureParams = {
  readonly error: unknown;
};

type Params = {
  readonly sessionId: SessionId;
  readonly terminalId: string;
  readonly scriptId: string;
  readonly name: string;
  readonly mountId: MountId;
  readonly command: string;
  readonly readTerminals: () => Promise<ReadonlyArray<LiveTerminal>>;
  readonly record: (params: RecordParams) => void;
  readonly onReadFailed: (params: FailureParams) => void;
  readonly now?: () => number;
};

export const trackTypedScriptRun = ({
  sessionId,
  terminalId,
  scriptId,
  name,
  mountId,
  command,
  readTerminals,
  record,
  onReadFailed,
  now = () => Date.now(),
}: Params): (() => void) => {
  const startedAt = now();
  const typed = command.trim();
  let stop: () => void = () => undefined;
  let isDone = false;
  let hasSeen = false;
  let failures = 0;
  const finish = (): void => {
    isDone = true;
    stop();
  };
  const read = (): void => {
    if (isDone) {
      return;
    }
    if (now() - startedAt > MAX_FOLLOW_MS) {
      finish();
      return;
    }
    readTerminals().then(
      (live) => {
        if (isDone) {
          return;
        }
        failures = 0;
        const terminal = live.find((candidate) => candidate.id === terminalId);
        if (terminal === undefined) {
          if (hasSeen) {
            finish();
          }
          return;
        }
        hasSeen = true;
        const exitCode = terminal.lastExitCode ?? null;
        if (
          exitCode === null ||
          isBusyTerminal({ terminal }) ||
          (terminal.lastExitCommand ?? '').trim() !== typed
        ) {
          return;
        }
        finish();
        record({ sessionId, scriptId, name, mountId, exitCode, startedAt });
      },
      (error: unknown) => {
        failures += 1;
        if (failures >= MAX_READ_FAILURES && !isDone) {
          finish();
          onReadFailed({ error });
        }
      },
    );
  };
  stop = startPoll({ run: read, everyMs: POLL_MS, gate: 'visible', isImmediate: false });
  return finish;
};
