import type { MountId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { pullRequestReminderIdOf } from './pullRequestReminderIdOf';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly prNumber: number;
};

const NO_SESSION = 'This session is gone.';

export const remindWhenGreen = async ({
  state,
  sessionId,
  mountId,
  prNumber,
}: Params): Promise<'unchanged' | undefined> => {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    throw new Error(NO_SESSION);
  }
  const result = await state.addReminder({
    workspaceId: session.workspaceId,
    text: `CI is green on #${prNumber}`,
    trigger: 'ci_green',
    dueAt: null,
    target: { kind: 'pull_request', id: pullRequestReminderIdOf({ sessionId, mountId, prNumber }) },
  });
  return result.isOk ? undefined : 'unchanged';
};
