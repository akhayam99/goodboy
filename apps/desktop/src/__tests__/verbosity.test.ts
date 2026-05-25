import { describe, it, expect, beforeEach } from 'vitest';
import {
  readWorkspaceVerbosity,
  writeWorkspaceVerbosity,
  verbosityDirective,
  VERBOSITY_LEVELS,
} from '../features/settings/verbosity';
import type { WorkspaceId } from '@goodboy/types';

const WORKSPACE = 'ws-1' as WorkspaceId;
const WORKSPACE_KEY = `goodboy:workspace-verbosity:${WORKSPACE}`;

beforeEach(() => localStorage.clear());

describe('readWorkspaceVerbosity', () => {
  it('returns null when absent', () => {
    expect(readWorkspaceVerbosity(WORKSPACE)).toBeNull();
  });

  it.each(VERBOSITY_LEVELS)('returns stored %s', (level) => {
    localStorage.setItem(WORKSPACE_KEY, level);
    expect(readWorkspaceVerbosity(WORKSPACE)).toBe(level);
  });

  it('returns null for unrecognized value', () => {
    localStorage.setItem(WORKSPACE_KEY, '???');
    expect(readWorkspaceVerbosity(WORKSPACE)).toBeNull();
  });

  it('normalizes legacy "minimal" → brief', () => {
    localStorage.setItem(WORKSPACE_KEY, 'minimal');
    expect(readWorkspaceVerbosity(WORKSPACE)).toBe('brief');
  });

  it('normalizes legacy "essential" → brief', () => {
    localStorage.setItem(WORKSPACE_KEY, 'essential');
    expect(readWorkspaceVerbosity(WORKSPACE)).toBe('brief');
  });

  it('normalizes legacy "detailed" → verbose', () => {
    localStorage.setItem(WORKSPACE_KEY, 'detailed');
    expect(readWorkspaceVerbosity(WORKSPACE)).toBe('verbose');
  });
});

describe('writeWorkspaceVerbosity', () => {
  it.each(VERBOSITY_LEVELS)('persists %s', (level) => {
    writeWorkspaceVerbosity(WORKSPACE, level);
    expect(readWorkspaceVerbosity(WORKSPACE)).toBe(level);
  });

  it('overwrite: last write wins', () => {
    writeWorkspaceVerbosity(WORKSPACE, 'brief');
    writeWorkspaceVerbosity(WORKSPACE, 'normal');
    expect(readWorkspaceVerbosity(WORKSPACE)).toBe('normal');
  });

  it('different workspace IDs are isolated', () => {
    const WS2 = 'ws-2' as WorkspaceId;
    writeWorkspaceVerbosity(WORKSPACE, 'brief');
    writeWorkspaceVerbosity(WS2, 'verbose');

    expect(readWorkspaceVerbosity(WORKSPACE)).toBe('brief');
    expect(readWorkspaceVerbosity(WS2)).toBe('verbose');
  });
});

describe('verbosityDirective', () => {
  it('brief directive contains BRIEF', () => {
    expect(verbosityDirective('brief')).toContain('BRIEF');
  });

  it('normal directive contains NORMAL', () => {
    expect(verbosityDirective('normal')).toContain('NORMAL');
  });

  it('verbose directive contains VERBOSE', () => {
    expect(verbosityDirective('verbose')).toContain('VERBOSE');
  });

  it('each level returns a non-empty string', () => {
    for (const level of VERBOSITY_LEVELS) {
      expect(verbosityDirective(level).length).toBeGreaterThan(0);
    }
  });

  it('directives are distinct across levels', () => {
    const directives = VERBOSITY_LEVELS.map(verbosityDirective);
    const unique = new Set(directives);
    expect(unique.size).toBe(VERBOSITY_LEVELS.length);
  });
});
