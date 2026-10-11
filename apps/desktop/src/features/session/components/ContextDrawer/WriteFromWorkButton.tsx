import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { linkedIssueSources } from '../../../../store/slices/issue-briefs/linkedIssueSources';
import { writeGoalFromWorkEvent } from '../../../../store/slices/issue-briefs/writeGoalFromWorkEvent';
import { lensPlace } from '../../../../store/slices/navigation/canonicalLocation';
import { dispatchAfterNavigation } from '../../../actions/dispatchAfterNavigation';

type Props = { readonly sessionId: SessionId; readonly isLocked: boolean };

export const WriteFromWorkButton = ({ sessionId, isLocked }: Props) => {
  const hasLinkedIssues = useAppStore(
    (state) =>
      linkedIssueSources({ tasks: state.sessionExternalTasks[sessionId] ?? [] }).length > 0,
  );
  if (!hasLinkedIssues) {
    return null;
  }
  const writeFromWork = () => {
    const state = useAppStore.getState();
    state.closeDrawer();
    state.navigate({ to: lensPlace({ state, sessionId, lens: null }) });
    dispatchAfterNavigation({ name: writeGoalFromWorkEvent({ sessionId }) });
  };
  return (
    <Button variant="ghost" size="sm" disabled={isLocked} onClick={writeFromWork}>
      Write title and goal from linked work
    </Button>
  );
};
