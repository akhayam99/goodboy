import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectKindRouting } from '../../../store/slices/agents/selectKindRouting';
import type { AgentKind, AgentKindRouting } from '../../../features/session/agent-kind';

type Params = {
  readonly sessionId: SessionId;
  readonly kind: AgentKind;
};

export const useKindRouting = ({ sessionId, kind }: Params): AgentKindRouting =>
  useAppStore(useShallow((state) => selectKindRouting({ state, sessionId, kind })));
