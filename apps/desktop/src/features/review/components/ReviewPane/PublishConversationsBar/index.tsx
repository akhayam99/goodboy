import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ResolvePublishStrip } from '../../../../resolve/components/ResolvePublishStrip';

type Props = {
  readonly sessionId: SessionId;
};

export const PublishConversationsBar = ({ sessionId }: Props) => (
  <div className={cn('flex flex-wrap items-end gap-x-4 gap-y-2', PANE_RHYTHM.dock)}>
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
      <ResolvePublishStrip sessionId={sessionId} />
    </div>
  </div>
);
