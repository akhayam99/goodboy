import type { AgentProviderId } from '../../../store/slices/providers/probeAgent';

export const AGENT_ROW_IDS = [
  'anthropic',
  'codex',
  'cursor',
  'gemini',
] as const satisfies ReadonlyArray<AgentProviderId>;
