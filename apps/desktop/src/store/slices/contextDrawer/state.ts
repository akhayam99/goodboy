import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { ContextDrawerSection } from '../drawer/state';

export type ContextDrawerSliceState = {
  readonly sessionContextSeenAt: Readonly<Record<SessionId, IsoDateTime | null>>;
};

export const contextDrawerInitialState: ContextDrawerSliceState = {
  sessionContextSeenAt: {},
};

export const DEFAULT_CONTEXT_SECTION: ContextDrawerSection = 'goal';
