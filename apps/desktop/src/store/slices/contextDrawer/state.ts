import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { ContextDrawerTab } from '../drawer/state';

export type ContextDrawerSliceState = {
  readonly sessionContextSeenAt: Readonly<Record<SessionId, IsoDateTime | null>>;
  readonly contextDrawerTab: Readonly<Record<SessionId, ContextDrawerTab>>;
};

export const initialContextDrawerState: ContextDrawerSliceState = {
  sessionContextSeenAt: {},
  contextDrawerTab: {},
};

export const DEFAULT_CONTEXT_TAB: ContextDrawerTab = 'summary';
