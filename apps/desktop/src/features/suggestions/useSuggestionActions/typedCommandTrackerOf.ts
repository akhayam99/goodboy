import type { MountId, SessionId } from '@goodboy/types';
import { READ_FAILED } from '../../../store/slices/notifications/errorRecovery';
import type { ReportErrorParams } from '../../../store/slices/notifications/reportError';
import { invokeTerminalListLive } from '../../terminal/terminal';
import { trackTypedScriptRun } from './trackTypedScriptRun';

type RecordParams = {
  readonly sessionId: SessionId;
  readonly scriptId: string;
  readonly name: string;
  readonly mountId: MountId;
  readonly exitCode: number;
  readonly startedAt: number;
};

type TrackParams = {
  readonly sessionId: SessionId;
  readonly terminalId: string;
  readonly scriptId: string;
  readonly name: string;
  readonly command: string;
  readonly mountId: MountId;
};

type Params = {
  readonly record: (params: RecordParams) => void;
  readonly reportError: (params: ReportErrorParams) => Promise<void>;
};

export const typedCommandTrackerOf =
  ({ record, reportError }: Params) =>
  ({ sessionId, terminalId, scriptId, name, command, mountId }: TrackParams): void => {
    trackTypedScriptRun({
      sessionId,
      terminalId,
      scriptId,
      name,
      mountId,
      command,
      readTerminals: invokeTerminalListLive,
      record,
      onReadFailed: ({ error }) => {
        void reportError({
          recovery: READ_FAILED,
          title: `Couldn't follow ${name} in the terminal`,
          error,
          severity: 'warning',
          sessionId,
        });
      },
    });
  };
