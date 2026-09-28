import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type Result = {
  readonly isBusy: boolean;
  readonly run: () => Promise<boolean>;
};

const PUSH_KEY = 'push';
const PUSH_PROGRESS_LABEL = 'Pushing the branch';
const PUSH_FAILURE_TITLE = "Couldn't push the branch";

export const usePushBranch = ({ sessionId, mountId }: Params): Result => {
  const pushSessionBranch = useAppStore((state) => state.pushSessionBranch);
  const beginSessionCreation = useAppStore((state) => state.beginSessionCreation);
  const endSessionCreation = useAppStore((state) => state.endSessionCreation);
  const action = usePendingAction({ sessionId });

  const run = (): Promise<boolean> =>
    action.run({
      key: PUSH_KEY,
      failureTitle: PUSH_FAILURE_TITLE,
      task: async () => {
        const creationId = beginSessionCreation(sessionId, {
          kind: 'branch',
          label: PUSH_PROGRESS_LABEL,
        });
        try {
          const result = await pushSessionBranch({ sessionId, mountId });
          if (!result.ok) {
            throw new Error(result.error);
          }
        } finally {
          endSessionCreation(sessionId, creationId);
        }
      },
    });

  return { isBusy: action.pendingKeys.has(PUSH_KEY), run };
};
