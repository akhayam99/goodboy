import type { ReactNode, Ref } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ContextUpdates } from './ContextUpdates';

type Props = {
  readonly sessionId: SessionId;
  readonly action: ReactNode;
  readonly cards?: ReactNode;
  readonly frameRef: Ref<HTMLDivElement>;
  readonly children: ReactNode;
};

export const ContextPageFrame = ({ sessionId, action, cards, frameRef, children }: Props) => (
  <div ref={frameRef} className={cn('flex min-w-0 flex-col', PANE_RHYTHM.block)}>
    <ContextUpdates sessionId={sessionId} action={action} />
    {cards ?? null}
    {children}
  </div>
);
