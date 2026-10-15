import type { AgentId, SessionId } from '@goodboy/types';
import type { AutoUserTurnPort } from '../../../features/auto/autoUserTurnPort';
import { isReportedError } from '../notifications/reportedError';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly port: AutoUserTurnPort;
  readonly sessionId: SessionId;
  readonly workspaceId: string;
  readonly agentId: AgentId;
  readonly text: string;
  readonly onKickoffAccepted: (() => void) | undefined;
};

const START_FAILED_TITLE = "Auto didn't start";
const LOST_MESSAGE = 'Auto could not take the first message. Send it again from the chat.';

export const sendAutoKickoff = ({
  get,
  port,
  sessionId,
  workspaceId,
  agentId,
  text,
  onKickoffAccepted,
}: Params): void => {
  void port({ agentId, sessionId, workspaceId, text })
    .then((result) => {
      if (result === 'queued') {
        onKickoffAccepted?.();
        return;
      }
      void get().reportError({
        title: START_FAILED_TITLE,
        error: new Error(LOST_MESSAGE),
        sessionId,
      });
    })
    .catch((error: unknown) => {
      if (isReportedError(error)) {
        return;
      }
      void get().reportError({ title: START_FAILED_TITLE, error, sessionId });
    });
};
