import { describe, expect, it } from 'vitest';
import { getDefaultBinary } from './cli-defaults';
import { launcherResumptionSupport } from './launcherResumption';

describe('launcherResumptionSupport', () => {
  it('reports the launchers that discard the resume session id', () => {
    expect(launcherResumptionSupport({ binary: 'cursor-agent' })).toBe('none');
    expect(launcherResumptionSupport({ binary: 'codex' })).toBe('none');
    expect(launcherResumptionSupport({ binary: 'agy' })).toBe('none');
  });

  it('reports the launchers that pass a session argument', () => {
    expect(launcherResumptionSupport({ binary: 'claude' })).toBe('native');
    expect(launcherResumptionSupport({ binary: 'opencode' })).toBe('native');
  });

  it('reads the launcher name out of an absolute path', () => {
    expect(launcherResumptionSupport({ binary: '/opt/homebrew/bin/codex' })).toBe('none');
    expect(launcherResumptionSupport({ binary: '/usr/local/bin/claude' })).toBe('native');
  });

  it('marks gemini ineligible because its launcher is agy', () => {
    expect(launcherResumptionSupport({ binary: getDefaultBinary('gemini') })).toBe('none');
  });
});
