import type { SessionId } from '@goodboy/types';
import { TEXT_ROLE, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { selectedReviewEntryOf } from '../../../../store/slices/review-source/activeReviewSource';
import { viewerBindingOf } from '../../../../store/slices/thread-reads/viewerBindingOf';
import { identityHealthOf } from '../../../integrations/identityHealthOf';

type Props = {
  readonly sessionId: SessionId;
};

export const IdentityQuietLine = ({ sessionId }: Props) => {
  const binding = useAppStore((state) =>
    viewerBindingOf({
      state,
      sessionId,
      entry: selectedReviewEntryOf({ state, sessionId, mountId: null }),
    }),
  );
  const health = identityHealthOf({ binding });
  if (!health.isMissing) {
    return null;
  }
  return (
    <p data-identity-quiet="" className={cn('px-3 text-meta', TEXT_ROLE.hint)}>
      {health.copy} Reconnect it in Settings, Integrations.
    </p>
  );
};
