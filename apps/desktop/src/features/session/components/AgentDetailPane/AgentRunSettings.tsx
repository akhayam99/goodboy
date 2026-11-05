import type { RefCallback } from 'react';
import type { Agent, Session } from '@goodboy/types';
import type { useAutoChat } from '../../../auto/chat/useAutoChat';
import { AgentRunRoute } from '../RunRoute/AgentRunRoute';
import { AgentSettingsLine } from '../AgentSettingsLine';
import { AutoGlanceLine } from './AutoGlanceLine';

type AutoView = NonNullable<ReturnType<typeof useAutoChat>['tree']>['view'];

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly autoView: AutoView | null;
  readonly asksSlotRef: RefCallback<HTMLElement>;
  readonly modelsSlotRef: RefCallback<HTMLElement>;
};

export const AgentRunSettings = ({
  session,
  agent,
  autoView,
  asksSlotRef,
  modelsSlotRef,
}: Props) => {
  const line = (
    <AgentSettingsLine
      session={session}
      kind={<AgentRunRoute session={session} agentId={agent.id} />}
      auto={
        autoView === null || autoView.budget === null
          ? null
          : { treeId: autoView.tree.id, facts: autoView.budget }
      }
      asksSlotRef={asksSlotRef}
      modelsSlotRef={modelsSlotRef}
    />
  );
  if (autoView === null) {
    return line;
  }
  return <AutoGlanceLine agent={agent} view={autoView} settings={line} />;
};
