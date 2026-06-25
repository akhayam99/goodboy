export const VERBOSITY_LEVELS = ['brief', 'normal', 'verbose'] as const
export type VerbosityLevel = (typeof VERBOSITY_LEVELS)[number]

export const VERBOSITY_LABEL: Record<VerbosityLevel, string> = {
  brief: 'Brief',
  normal: 'Normal',
  verbose: 'Verbose',
}

export const VERBOSITY_DOT: Record<VerbosityLevel, string> = {
  brief: 'bg-success',
  normal: 'bg-info',
  verbose: 'bg-danger',
}

const VERBOSITY_DIRECTIVE: Record<VerbosityLevel, string> = {
  brief:
    'Output verbosity: BRIEF. Output only what is strictly required to answer or act. No preambles, no recaps, no explanations unless asked. Single short sentence per update; one-line end-of-turn.',
  normal:
    'Output verbosity: NORMAL. Standard prose. Include rationale when non-obvious; avoid filler.',
  verbose:
    'Output verbosity: VERBOSE. Include reasoning, alternatives considered, and trade-offs. Long-form is acceptable.',
}

export const verbosityDirective = (level: VerbosityLevel): string => {
  return VERBOSITY_DIRECTIVE[level]
}
