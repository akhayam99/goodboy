import { kindRouting } from '../../agent-kind';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';

const GENERIC_ROUTING = kindRouting({ kind: 'generic' });

export const DEFAULT_AGENT_SPAWN_CONFIG = {
  provider: '',
  model: GENERIC_ROUTING.model,
  effort: GENERIC_ROUTING.effort,
  hint: '',
} satisfies AgentSpawnConfigValue;
