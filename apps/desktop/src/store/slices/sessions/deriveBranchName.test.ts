import { describe, expect, it } from 'vitest';
import { deriveBranchName } from './deriveBranchName';

const ID = '12345678-rest';

describe('deriveBranchName', () => {
  it('keeps an explicit seed slug untouched', () => {
    expect(
      deriveBranchName({
        prefix: 'ak',
        sessionId: ID,
        goal: 'Ignored goal',
        explicitSlug: 'Foreign_Feature/Exact',
        taskIdentifiers: ['GRW-1'],
      }),
    ).toBe('Foreign_Feature/Exact');
  });

  it('builds a task slug without an id suffix and strips bracketed tokens', () => {
    expect(
      deriveBranchName({
        prefix: 'ak',
        sessionId: ID,
        goal: '[GRW-1220] [FE] Applicare nuove icone alla navbar',
        taskIdentifiers: ['GRW-1220'],
      }),
    ).toBe('grw-1220-applicare-nuove-icone-alla-navbar');
  });

  it('strips an unbracketed identifier from the goal case insensitively', () => {
    expect(
      deriveBranchName({
        prefix: 'ak',
        sessionId: ID,
        goal: 'Fix grw-1220 navigation for GRW-1220',
        taskIdentifiers: ['GRW-1220'],
      }),
    ).toBe('grw-1220-fix-navigation-for');
  });

  it('adds the id suffix when another live session owns the task branch', () => {
    expect(
      deriveBranchName({
        prefix: 'ak',
        sessionId: ID,
        goal: 'Fix navigation',
        taskIdentifiers: ['GRW-1220'],
        existingBranches: ['ak/grw-1220-fix-navigation'],
      }),
    ).toBe('grw-1220-fix-navigation-12345678');
  });

  it('builds a goal slug with the id suffix', () => {
    expect(deriveBranchName({ prefix: 'ak', sessionId: ID, goal: 'Build navigation' })).toBe(
      'build-navigation-12345678',
    );
  });

  it('uses a session slug for placeholder goals', () => {
    expect(deriveBranchName({ prefix: 'ak', sessionId: ID, goal: 'Untitled session' })).toBe(
      'session-12345678',
    );
    expect(deriveBranchName({ prefix: 'ak', sessionId: ID, goal: '' })).toBe('session-12345678');
  });

  it('caps the slug at a complete word before 48 characters', () => {
    const slug = deriveBranchName({
      prefix: 'ak',
      sessionId: ID,
      goal: 'Implement extraordinarily detailed navigation behavior across every workspace',
    });
    expect(slug).toBe('implement-extraordinarily-detailed-12345678');
    expect(slug.length).toBeLessThanOrEqual(48);
  });
});
