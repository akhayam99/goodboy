import { useMemo } from 'react';
import { Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ObjectActionVerb } from '../../../actions/ObjectActionVerb';
import { LANE_READY_FIX_FIRST } from '../../laneCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly threadId: string;
};

export const ReadyFixFirst = ({ sessionId, threadId }: Props) => {
  const target = useMemo(
    () => ({ kind: 'reviewComment' as const, sessionId, threadId }),
    [sessionId, threadId],
  );
  return (
    <Notice
      tone="info"
      placement="inline"
      role="status"
      title={LANE_READY_FIX_FIRST}
      actions={
        <>
          <ObjectActionVerb target={target} actionId="reviewComment.accept" />
          <ObjectActionVerb target={target} actionId="reviewComment.skip" />
        </>
      }
    />
  );
};
