import type { AgentId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { useAppStore } from '../../../../store';

type Params = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_decision' }>;
  readonly agentId: AgentId | null;
};

export const useIsStoppedBeforeAnswer = ({ item, agentId }: Params): boolean => {
  const isRuleAllow =
    item.decision === 'allow' &&
    item.scope !== undefined &&
    item.scope !== 'once' &&
    item.scope !== 'deny';
  return useAppStore((state) => {
    if (!isRuleAllow || agentId === null) {
      return false;
    }
    const kind = state.agentTurnState[agentId]?.kind;
    if (kind === 'running' || kind === 'starting') {
      return false;
    }
    const last = (state.transcripts[agentId] ?? []).at(-1);
    return last?.kind === 'permission_decision' && last.toolUseId === item.toolUseId;
  });
};
