import type { SessionId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export const diffCommentsInFlight = new Set<SessionId>();
