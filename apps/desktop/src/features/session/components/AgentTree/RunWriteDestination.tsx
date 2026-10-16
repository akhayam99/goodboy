import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectWritableMounts } from '../../../../store/slices/project-mounts/selectors';
import { WriteDestinationControl } from '../../../chat/components/WriteDestinationControl';

type Props = {
  readonly sessionId: SessionId;
};

export const RunWriteDestination = ({ sessionId }: Props) => {
  const writableMountCount = useAppStore(
    (state) => selectWritableMounts({ state, sessionId }).length,
  );
  if (writableMountCount <= 1) {
    return null;
  }
  return (
    <WriteDestinationControl
      sessionId={sessionId}
      agentId={null}
      fallback="automatic"
      verb="Writes to"
    />
  );
};
