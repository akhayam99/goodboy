import type { AgentId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { useStoppedAnswer } from '../../../../store/hooks/useStoppedAnswer';

type Params = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_decision' }>;
  readonly agentId: AgentId | null;
};

export const useIsStoppedBeforeAnswer = ({ item, agentId }: Params): boolean =>
  useStoppedAnswer({ agentId })?.toolUseId === item.toolUseId;
