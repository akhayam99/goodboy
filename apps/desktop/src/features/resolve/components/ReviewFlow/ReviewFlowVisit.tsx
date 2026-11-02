import type { ComponentProps } from 'react';
import { useThreadVisit } from '../../hooks/useThreadVisit';
import { ReviewFlow } from '.';
import { ThreadVisitContext } from './threadVisitContext';

type Props = ComponentProps<typeof ReviewFlow> & {
  readonly isVisible: boolean;
};

export const ReviewFlowVisit = ({ isVisible, ...flow }: Props) => {
  const unreadIds = useThreadVisit({
    sessionId: flow.session.id,
    mountId: flow.mountId ?? null,
    isVisible,
  });
  return (
    <ThreadVisitContext.Provider value={unreadIds}>
      <ReviewFlow {...flow} />
    </ThreadVisitContext.Provider>
  );
};
