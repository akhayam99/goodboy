import type { AgentId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export type ApprovePlanResult =
  | Readonly<{ kind: 'approved'; next: 'continues' | 'started'; agentId: AgentId | null }>
  | Readonly<{ kind: 'noop'; reason: 'missing-run' | 'not-held' }>
  | Readonly<{ kind: 'failed'; message: string }>;
