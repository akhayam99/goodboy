import { ArrowUp } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { usePushBranch } from '../../../session/hooks/usePushBranch';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly onPushed: () => void;
};

export const PushBranchButton = ({ sessionId, mountId, onPushed }: Props) => {
  const push = usePushBranch({ sessionId, mountId });
  return (
    <Button
      variant="primary"
      size="sm"
      isBusy={push.isBusy}
      onClick={() =>
        void push.run().then((isPushed) => {
          if (isPushed) {
            onPushed();
          }
        })
      }
    >
      <ArrowUp size={ICON_SIZE.row} aria-hidden />
      Push branch
    </Button>
  );
};
