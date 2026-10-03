import type { AutoContext } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { scopedRoutingScope } from './scopedKindRouting';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

export const selectRoutingScope = ({ state, sessionId }: Params): AutoContext | null =>
  scopedRoutingScope({ state, settings: selectResolvedSettings({ state, sessionId }) });
