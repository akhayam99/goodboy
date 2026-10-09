import { GitPullRequest } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useActionControls } from '../../../actions/useActionControls';

type Props = {
  readonly sessionId: SessionId;
};

const CREATE_ACTION_ID = 'pullRequest.create';

export const NoPullRequestState = ({ sessionId }: Props) => {
  const create = useActionControls({
    target: { kind: 'pullRequest', sessionId, prNumber: null },
  });
  const createAction = create.actions.find((action) => action.id === CREATE_ACTION_ID);
  return (
    <EmptyState
      icon={GitPullRequest}
      title="No pull request yet"
      action={
        <Button
          size="sm"
          variant="secondary"
          disabled={createAction === undefined || createAction.blockedReason !== null}
          onClick={() => create.trigger({ actionId: CREATE_ACTION_ID })}
        >
          Create pull request
        </Button>
      }
    />
  );
};
