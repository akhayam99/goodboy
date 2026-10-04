import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { OpenSessionButton } from '../../../shared/components/OpenSessionButton';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { sessionTitle } from '../../session/sessionTitle';

type Props = {
  readonly sessionIds: ReadonlyArray<SessionId>;
  readonly onOpened: () => void;
};

export const LinkedSessionButtons = ({ sessionIds, onOpened }: Props) => {
  const titles = useAppStore(
    useShallow((state) =>
      sessionIds.map((sessionId) => {
        const session = sessionById(state.sessions, sessionId);
        return session === undefined ? 'Open session' : sessionTitle({ session });
      }),
    ),
  );
  const [first, ...others] = sessionIds;
  if (first === undefined) {
    return null;
  }
  if (others.length === 0) {
    return <OpenSessionButton sessionId={first} onOpened={onOpened} />;
  }
  return (
    <div role="group" aria-label="Sessions on this task" className="flex flex-wrap gap-2">
      {sessionIds.map((sessionId, index) => (
        <OpenSessionButton
          key={sessionId}
          sessionId={sessionId}
          onOpened={onOpened}
          label={titles[index] ?? 'Open session'}
          variant={index === 0 ? undefined : 'ghost'}
        />
      ))}
    </div>
  );
};
