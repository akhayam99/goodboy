import { useContext } from 'react';
import type { AgentId, Session } from '@goodboy/types';
import { AgentHeader } from '../AgentDetailPane/AgentHeader';
import type { RunView } from '../AgentTree/useRunView';
import { RunPageActions } from '../PresetRun/RunPageActions';
import { SessionHeadSlotsContext } from '../../sessionHeadSlotsContext';
import { HeadSlotPortal } from '../HeadSlotPortal';
import { RunHeadBranches } from './RunHeadBranches';
import { RunStatusChip } from './RunStatusChip';
import { RunTitle } from './RunTitle';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly stepAgentId: AgentId | null;
};

export const RunPageHead = ({ session, view, stepAgentId }: Props) => {
  const isInHead = useContext(SessionHeadSlotsContext) !== null;
  const title = <RunTitle session={session} view={view} stepAgentId={stepAgentId} />;
  const actions = <RunPageActions session={session} view={view} stepAgentId={stepAgentId} />;
  if (isInHead) {
    return (
      <>
        <HeadSlotPortal slot="title">{title}</HeadSlotPortal>
        <HeadSlotPortal slot="meta">
          <span data-run-head-meta="" className="flex min-w-0 items-center gap-3 text-meta">
            <RunStatusChip view={view} />
            <RunHeadBranches session={session} runId={view.run.id} />
            {actions}
          </span>
        </HeadSlotPortal>
      </>
    );
  }
  return (
    <AgentHeader
      title={title}
      meta={
        <span className="flex min-w-0 items-center gap-2">
          <RunStatusChip view={view} />
          <RunHeadBranches session={session} runId={view.run.id} />
        </span>
      }
      actions={actions}
    />
  );
};
