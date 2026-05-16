import type { AgentId, SessionId } from '@kay-am/types';
import { STORAGE_PREFIXES } from './storage-keys';

export const VERBOSITY_LEVELS = ['brief', 'normal', 'verbose'] as const;
export type VerbosityLevel = (typeof VERBOSITY_LEVELS)[number];

export const VERBOSITY_LABEL: Record<VerbosityLevel, string> = {
  brief: 'Brief',
  normal: 'Normal',
  verbose: 'Verbose',
};

const STORAGE_PREFIX = STORAGE_PREFIXES.verbosity;
const DEFAULT_LEVEL: VerbosityLevel = 'normal';

const LEGACY_MAP: Record<string, VerbosityLevel> = {
  essential: 'brief',
  minimal: 'brief',
  detailed: 'verbose',
};

export function readVerbosity(sessionId: SessionId): VerbosityLevel {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
    if (!raw) return DEFAULT_LEVEL;
    if ((VERBOSITY_LEVELS as ReadonlyArray<string>).includes(raw)) return raw as VerbosityLevel;
    if (raw in LEGACY_MAP) return LEGACY_MAP[raw]!;
  } catch {
    // ignore
  }
  return DEFAULT_LEVEL;
}

export function writeVerbosity(sessionId: SessionId, level: VerbosityLevel): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, level);
  } catch {
    // ignore
  }
}

const AGENT_STORAGE_PREFIX = STORAGE_PREFIXES.agentVerbosity;

export function readAgentVerbosity(agentId: AgentId): VerbosityLevel | null {
  try {
    const raw = localStorage.getItem(`${AGENT_STORAGE_PREFIX}${agentId}`);
    if (!raw) return null;
    if ((VERBOSITY_LEVELS as ReadonlyArray<string>).includes(raw)) return raw as VerbosityLevel;
    if (raw in LEGACY_MAP) return LEGACY_MAP[raw]!;
  } catch {
    // ignore
  }
  return null;
}

export function writeAgentVerbosity(agentId: AgentId, level: VerbosityLevel): void {
  try {
    localStorage.setItem(`${AGENT_STORAGE_PREFIX}${agentId}`, level);
  } catch {
    // ignore
  }
}

const VERBOSITY_DIRECTIVE: Record<VerbosityLevel, string> = {
  brief:
    'Output verbosity: BRIEF. Output only what is strictly required to answer or act. No preambles, no recaps, no explanations unless asked. Single short sentence per update; one-line end-of-turn.',
  normal:
    'Output verbosity: NORMAL. Standard prose. Include rationale when non-obvious; avoid filler.',
  verbose:
    'Output verbosity: VERBOSE. Include reasoning, alternatives considered, and trade-offs. Long-form is acceptable.',
};

export function verbosityDirective(level: VerbosityLevel): string {
  return VERBOSITY_DIRECTIVE[level];
}
