import type { SessionId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

// In-flight dedup for the lazy pending-resolutions load, fired by both the
// ContextPanel strip and the resolved-comment chip. Mirrors diffCommentsInFlight.
export const pendingResolutionsInFlight = new Set<SessionId>();
