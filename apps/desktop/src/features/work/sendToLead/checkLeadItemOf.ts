import type { MountId, SessionId } from '@goodboy/types';
import type { CheckLogReading } from '../../../store/slices/checks-log/types';
import type { MountGithubState } from '../../../store/types';
import { checkPayloadOf } from './checkPayloadOf';
import { failedCheckOf } from './failedCheckOf';
import type { LeadSend } from './LeadSend';
import { SEND_TO_LEAD_COPY } from './sendToLeadCopy';

const LOG_LINES = 40;

type Params = {
  readonly github: MountGithubState | undefined;
  readonly reading: CheckLogReading | undefined;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const checkLeadItemOf = ({
  github,
  reading,
  sessionId,
  mountId,
}: Params): LeadSend | null => {
  const failed = failedCheckOf({ github });
  if (github === undefined || failed === null) {
    return null;
  }
  const logTail = reading?.status === 'ready' ? reading.lines.slice(-LOG_LINES).join('\n') : null;
  const pr = github.pr;
  return {
    lead: {
      sessionId,
      projectId: github.projectId,
      branch: github.branch,
      holderAgentId: null,
      holdReason: SEND_TO_LEAD_COPY.workedCheck,
    },
    send: { sessionId, threadId: null, mountId, branch: github.branch },
    textOf: ({ note }) =>
      checkPayloadOf({
        payload: {
          name: failed.name,
          detailsUrl: failed.detailsUrl,
          logTail,
          branch: github.branch,
          prNumber: pr?.number ?? null,
          prUrl: pr?.url ?? null,
          changedPaths: [],
          note,
        },
      }),
  };
};
