import { AGENT_KIND_DEFAULTS } from '../../agent-kind';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';

export const DEFAULT_AGENT_SPAWN_CONFIG = {
  provider: '',
  model: AGENT_KIND_DEFAULTS.generic.model,
  effort: AGENT_KIND_DEFAULTS.generic.effort,
  hint: '',
} satisfies AgentSpawnConfigValue;
