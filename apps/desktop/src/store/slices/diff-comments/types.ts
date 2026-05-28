import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';

export type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
export type GetFn = () => AppStore;

// In-flight dedup for actions whose store slice has no native loading flag.
// Prevents the second fetch when ContextPanel's effect fires twice (StrictMode
// remount, or rapid keep-alive activation) before the first round-trip lands.
export const diffCommentsInFlight = new Set<SessionId>();
