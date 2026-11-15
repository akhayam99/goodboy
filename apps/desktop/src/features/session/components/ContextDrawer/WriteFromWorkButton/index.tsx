import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store/store';
import { linkedIssueSources } from '../../../../../store/slices/issue-briefs/linkedIssueSources';
import { writeGoalFromWorkEvent } from '../../../../../store/slices/issue-briefs/writeGoalFromWorkEvent';
import { lensPlace } from '../../../../../store/slices/navigation/canonicalLocation';
import { dispatchAfterNavigation } from '../../../../actions/dispatchAfterNavigation';

type Props = {
  readonly sessionId: SessionId;
  readonly isLocked: boolean;
  readonly look?: 'action' | 'footer';
  readonly fallback?: ReactNode;
};

export const WriteFromWorkButton = ({
  sessionId,
  isLocked,
  look = 'footer',
  fallback = null,
}: Props) => {
  const hasLinkedIssues = useAppStore(
    (state) =>
      linkedIssueSources({ tasks: state.sessionExternalTasks[sessionId] ?? [] }).length > 0,
  );
  if (!hasLinkedIssues) {
    return fallback;
  }
  const writeFromWork = () => {
    const state = useAppStore.getState();
    state.clearDrawer();
    state.navigate({ to: lensPlace({ state, sessionId, lens: null }) });
    dispatchAfterNavigation({ name: writeGoalFromWorkEvent({ sessionId }) });
  };
  if (look === 'action') {
    return (
      <Button variant="secondary" size="sm" disabled={isLocked} onClick={writeFromWork}>
        <Pencil size={ICON_SIZE.row} aria-hidden />
        Write title and goal from linked work
      </Button>
    );
  }
  return (
    <Button
      variant="quiet"
      size="sm"
      className="self-start px-0 font-normal hover:bg-transparent"
      disabled={isLocked}
      onClick={writeFromWork}
    >
      <Pencil size={ICON_SIZE.row} aria-hidden />
      Write title and goal from linked work
    </Button>
  );
};
