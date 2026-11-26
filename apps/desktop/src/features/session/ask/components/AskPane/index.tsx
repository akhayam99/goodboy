import { Suspense } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { lazyNamed } from '../../../../../shared/lib/lazyNamed';

const AskPaneBody = lazyNamed({
  load: () => import('./AskPaneBody'),
  pick: ({ AskPaneBody }) => AskPaneBody,
});

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const AskPane = ({ sessionId, onClose }: Props) => {
  const session = useAppStore((state) => sessionById(state.sessions, sessionId));
  if (session === undefined) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <AskPaneBody key={sessionId} session={session} onClose={onClose} />
    </Suspense>
  );
};
