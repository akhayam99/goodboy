import type { AgentId, Session } from '@goodboy/types';
import { AgentHeader } from '../AgentDetailPane/AgentHeader';
import type { RunView } from '../AgentTree/useRunView';
import { RunPageActions } from '../PresetRun/RunPageActions';
import { RunHeadBranches } from './RunHeadBranches';
import { RunStatusChip } from './RunStatusChip';
import { RunTitle } from './RunTitle';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly stepAgentId: AgentId | null;
};

export const RunPageHead = ({ session, view, stepAgentId }: Props) => (
  <AgentHeader
    title={<RunTitle session={session} view={view} stepAgentId={stepAgentId} />}
    meta={
      <span className="flex min-w-0 items-center gap-2">
        <RunStatusChip view={view} />
        <RunHeadBranches session={session} runId={view.run.id} />
      </span>
    }
    actions={<RunPageActions session={session} view={view} stepAgentId={stepAgentId} />}
  />
);
