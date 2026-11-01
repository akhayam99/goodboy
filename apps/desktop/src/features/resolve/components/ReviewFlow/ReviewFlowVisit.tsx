import type { ComponentProps } from 'react';
import { useThreadVisit } from '../../hooks/useThreadVisit';
import { ReviewFlow } from '.';
import { ThreadVisitContext } from './threadVisitContext';

type Props = ComponentProps<typeof ReviewFlow>;

export const ReviewFlowVisit = ({ session, mountId = null, push }: Props) => {
  const unreadIds = useThreadVisit({ sessionId: session.id, mountId });
  return (
    <ThreadVisitContext.Provider value={unreadIds}>
      <ReviewFlow session={session} mountId={mountId} push={push} />
    </ThreadVisitContext.Provider>
  );
};
