import type { TaskId } from '@kay-am/types';

export const VERBOSITY_LEVELS = ['essential', 'minimal', 'normal', 'detailed', 'verbose'] as const;
export type VerbosityLevel = (typeof VERBOSITY_LEVELS)[number];

export const VERBOSITY_LABEL: Record<VerbosityLevel, string> = {
  essential: 'Essential',
  minimal: 'Minimal',
  normal: 'Normal',
  detailed: 'Detailed',
  verbose: 'Verbose',
};

const STORAGE_PREFIX = 'kayam:verbosity:';
const DEFAULT_LEVEL: VerbosityLevel = 'essential';

export function readVerbosity(taskId: TaskId): VerbosityLevel {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${taskId}`);
    if (raw && (VERBOSITY_LEVELS as ReadonlyArray<string>).includes(raw)) {
      return raw as VerbosityLevel;
    }
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
  essential:
    'Output verbosity: ESSENTIAL. Output only what is strictly required to answer or act. No preambles, no recaps, no explanations unless asked. Single short sentence per update; one-line end-of-turn.',
  minimal:
    'Output verbosity: MINIMAL. Brief but complete. Skip narration and pleasantries. Short paragraphs only when needed.',
  normal:
    'Output verbosity: NORMAL. Standard prose. Include rationale when non-obvious; avoid filler.',
  detailed:
    'Output verbosity: DETAILED. Provide additional context and rationale where it aids the reader. Still no filler or pleasantries.',
  verbose:
    'Output verbosity: VERBOSE. Include reasoning, alternatives considered, and trade-offs. Long-form is acceptable.',
};

export function verbosityDirective(level: VerbosityLevel): string {
  return VERBOSITY_DIRECTIVE[level];
}
