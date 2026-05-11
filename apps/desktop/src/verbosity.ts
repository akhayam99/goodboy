import type { TaskId } from '@kay-am/types';

export const VERBOSITY_LEVELS = ['brief', 'normal', 'verbose'] as const;
export type VerbosityLevel = (typeof VERBOSITY_LEVELS)[number];

export const VERBOSITY_LABEL: Record<VerbosityLevel, string> = {
  brief: 'Brief',
  normal: 'Normal',
  verbose: 'Verbose',
};

const STORAGE_PREFIX = 'kayam:verbosity:';
const DEFAULT_LEVEL: VerbosityLevel = 'normal';

const LEGACY_MAP: Record<string, VerbosityLevel> = {
  essential: 'brief',
  minimal: 'brief',
  detailed: 'verbose',
};

export function readVerbosity(taskId: TaskId): VerbosityLevel {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${taskId}`);
    if (!raw) return DEFAULT_LEVEL;
    if ((VERBOSITY_LEVELS as ReadonlyArray<string>).includes(raw)) return raw as VerbosityLevel;
    if (raw in LEGACY_MAP) return LEGACY_MAP[raw]!;
  } catch {
    // ignore
  }
  return DEFAULT_LEVEL;
}

export function writeVerbosity(taskId: TaskId, level: VerbosityLevel): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${taskId}`, level);
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
