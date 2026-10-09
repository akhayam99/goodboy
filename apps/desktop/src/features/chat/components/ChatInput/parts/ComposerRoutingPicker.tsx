import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { useTurnRouting } from '../hooks/useTurnRouting';
import { ComposerAgentRoutingPicker } from './ComposerAgentRoutingPicker';
import { ComposerRoutingPickerView } from './ComposerRoutingPickerView';

type Props = {
  readonly session: Session;
  readonly routing: ReturnType<typeof useTurnRouting>;
};

export const ComposerRoutingPicker = ({ session, routing }: Props) => {
  const agent = useAppStore((state) => {
    const agentId = state.selectedAgentId[session.id] ?? null;
    return agentId === null
      ? null
      : ((state.sessionPhaseRuns[session.id] ?? []).find((run) => run.id === agentId) ?? null);
  });
  if (agent === null) {
    return <ComposerRoutingPickerView routing={routing} header={null} />;
  }
  return <ComposerAgentRoutingPicker session={session} agent={agent} routing={routing} />;
};
