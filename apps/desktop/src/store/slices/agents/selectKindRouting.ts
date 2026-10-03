import type { SessionId } from '@goodboy/types';
import type { AgentKind, AgentKindRouting } from '../../../features/session/agent-kind';
import type { AppStore } from '../../store';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { scopedKindRouting } from './scopedKindRouting';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly kind: AgentKind;
};

export const selectKindRouting = ({ state, sessionId, kind }: Params): AgentKindRouting =>
  scopedKindRouting({ state, settings: selectResolvedSettings({ state, sessionId }), kind });
