import { describe, expect, it } from 'vitest';
import { matchRoleLibrary } from './matchRoleLibrary';
import { ROLE_LIBRARY } from './roleLibrary';

const labels = (query: string, exclude?: ReadonlyArray<string>): ReadonlyArray<string> =>
  matchRoleLibrary({ query, ...(exclude !== undefined && { exclude }) }).map(
    (entry) => entry.label,
  );

describe('matchRoleLibrary', () => {
  it('ships 31 roles with unique ids and labels', () => {
    expect(ROLE_LIBRARY).toHaveLength(31);
    expect(new Set(ROLE_LIBRARY.map((entry) => entry.id)).size).toBe(31);
    expect(new Set(ROLE_LIBRARY.map((entry) => entry.label)).size).toBe(31);
  });

  it('matches a substring of the label', () => {
    expect(labels('eng')).toContain('Data Engineer');
    expect(labels('eng')).toContain('AI Engineer');
    expect(labels('eng')).not.toContain('Founder');
  });

  it('matches aliases', () => {
    expect(labels('sre')).toEqual(['Site Reliability Engineer']);
    expect(labels('pm')).toEqual(['Product Manager']);
  });

  it('leaves out the roles already picked, whatever their case', () => {
    expect(labels('lead', ['tech lead'])).not.toContain('Tech Lead');
  });

  it('offers the whole library for an empty query', () => {
    expect(labels('')).toHaveLength(31);
  });
});
