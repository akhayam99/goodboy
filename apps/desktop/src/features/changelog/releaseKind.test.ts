import { describe, expect, it } from 'vitest';
import { releaseKindOf } from './releaseKind';

describe('releaseKindOf', () => {
  it('calls a nonzero patch segment a patch', () => {
    expect(releaseKindOf({ version: '0.12.1' })).toBe('patch');
    expect(releaseKindOf({ version: '1.0.1' })).toBe('patch');
  });

  it('calls a reset patch with a nonzero minor segment a minor', () => {
    expect(releaseKindOf({ version: '0.12.0' })).toBe('minor');
    expect(releaseKindOf({ version: '1.2.0' })).toBe('minor');
  });

  it('calls a reset minor and patch on a nonzero major segment a major', () => {
    expect(releaseKindOf({ version: '1.0.0' })).toBe('major');
    expect(releaseKindOf({ version: '2.0.0' })).toBe('major');
  });
});
