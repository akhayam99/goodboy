import type { SessionId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

// In-flight dedup for actions whose store slice has no native loading flag.
// Prevents the second fetch when ContextPanel's effect fires twice (StrictMode
// remount, or rapid keep-alive activation) before the first round-trip lands.
export const diffCommentsInFlight = new Set<SessionId>();
