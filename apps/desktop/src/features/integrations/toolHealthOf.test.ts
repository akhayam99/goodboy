import { describe, expect, it } from 'vitest';
import { QUIET_TOOL_HEALTH } from '../../__tests__/helpers/quietToolHealth';
import { toolHealthOf } from './toolHealthOf';

describe('toolHealthOf', () => {
  it('stays quiet for a connected tool whose key is there', () => {
    expect(toolHealthOf({ tool: 'linear', isConnected: true, secret: 'present' })).toEqual(
      QUIET_TOOL_HEALTH,
    );
  });

  it('stays quiet while the keychain answer has not landed', () => {
    expect(toolHealthOf({ tool: 'linear', isConnected: true, secret: 'unknown' })).toEqual(
      QUIET_TOOL_HEALTH,
    );
  });

  it('marks a missing key as danger with a chip and a reason', () => {
    expect(toolHealthOf({ tool: 'linear', isConnected: true, secret: 'missing' })).toEqual({
      signal: 'danger',
      chip: 'Key missing',
      reason: 'Key missing on this Mac',
    });
  });

  it('keeps the reason within the rail attention budget', () => {
    const reason = toolHealthOf({ tool: 'jira', isConnected: true, secret: 'missing' }).reason;

    expect(reason?.length).toBeLessThanOrEqual(24);
  });

  it('ignores a key that is missing when the tool is not connected', () => {
    expect(toolHealthOf({ tool: 'jira', isConnected: false, secret: 'missing' })).toEqual(
      QUIET_TOOL_HEALTH,
    );
  });

  it('never flags GitHub, which has no stored key in the binding', () => {
    expect(toolHealthOf({ tool: 'github', isConnected: true, secret: 'missing' })).toEqual(
      QUIET_TOOL_HEALTH,
    );
  });
});
