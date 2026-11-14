import type { ReactNode, Ref } from 'react';
import { BandStack } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ContextUpdates } from './ContextUpdates';

type Props = {
  readonly sessionId: SessionId;
  readonly action: ReactNode;
  readonly frameRef: Ref<HTMLDivElement>;
  readonly children: ReactNode;
};

export const ContextPageFrame = ({ sessionId, action, frameRef, children }: Props) => (
  <div ref={frameRef} className="flex min-w-0 flex-col gap-4">
    <div className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1">
        <ContextUpdates sessionId={sessionId} />
      </div>
      {action}
    </div>
    <BandStack>{children}</BandStack>
  </div>
);
