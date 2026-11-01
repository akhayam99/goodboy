import type { ComponentProps } from 'react';
import { useThreadVisit } from '../../hooks/useThreadVisit';
import { ReviewFlow } from '.';
import { ThreadVisitContext } from './threadVisitContext';

type Props = ComponentProps<typeof ReviewFlow> & {
  readonly isVisible: boolean;
};

export const ReviewFlowVisit = ({ session, mountId = null, push, isVisible }: Props) => {
  const unreadIds = useThreadVisit({ sessionId: session.id, mountId, isVisible });
  return (
    <ThreadVisitContext.Provider value={unreadIds}>
      <ReviewFlow session={session} mountId={mountId} push={push} />
    </ThreadVisitContext.Provider>
  );
};
