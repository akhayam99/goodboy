import type { ReactNode } from 'react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { AutoAgentGroup } from '../../../auto/group/AutoAgentGroup';
import type { LiveAutoGroup } from './liveGroupsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveAutoGroup;
  readonly chip?: ReactNode;
};

export const LiveAutoBlock = ({ sessionId, group, chip }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  return (
    <div data-live-group="auto" data-state={group.state} className="relative flex flex-col gap-1">
      <span className="absolute inset-x-0 top-0 h-5">
        <button
          type="button"
          aria-label="Open Auto chat"
          onClick={() =>
            navigate({ to: agentPlace({ sessionId, agentId: group.group.rootAgentId }) })
          }
          className={cn('absolute inset-0 rounded-md', ROW_INTERACTIVE)}
        />
      </span>
      <AutoAgentGroup group={group.group} isCompact={false} />
      {chip}
    </div>
  );
};
