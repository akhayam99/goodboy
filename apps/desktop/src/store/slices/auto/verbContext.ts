import type { Database } from '@goodboy/db';
import type { AutoPorts } from './ports';
import type { AutoScheduler } from './scheduler';

export type AgentVerbContext = Readonly<{
  db: Database;
  scheduler: AutoScheduler;
  ports: AutoPorts;
  now: () => number;
}>;
