import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../shared/lib/storage-keys';

export const VERBOSITY_LEVELS = ['brief', 'normal', 'verbose'] as const;
export type VerbosityLevel = (typeof VERBOSITY_LEVELS)[number];

export const VERBOSITY_LABEL: Record<VerbosityLevel, string> = {
  brief: 'Brief',
  normal: 'Normal',
  verbose: 'Verbose',
};

const WORKSPACE_STORAGE_PREFIX = STORAGE_PREFIXES.workspaceVerbosity;

const LEGACY_MAP: Record<string, VerbosityLevel> = {
  essential: 'brief',
  minimal: 'brief',
  detailed: 'verbose',
};

function normalizeVerbosity(raw: string | null): VerbosityLevel | null {
  if (!raw) return null;
  if ((VERBOSITY_LEVELS as ReadonlyArray<string>).includes(raw)) return raw as VerbosityLevel;
  if (raw in LEGACY_MAP) return LEGACY_MAP[raw]!;
  return null;
}

export function readWorkspaceVerbosity(workspaceId: WorkspaceId): VerbosityLevel | null {
  try {
    return normalizeVerbosity(localStorage.getItem(`${WORKSPACE_STORAGE_PREFIX}${workspaceId}`));
  } catch {
    return null;
  }
}

export function writeWorkspaceVerbosity(workspaceId: WorkspaceId, level: VerbosityLevel): void {
  try {
    localStorage.setItem(`${WORKSPACE_STORAGE_PREFIX}${workspaceId}`, level);
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
