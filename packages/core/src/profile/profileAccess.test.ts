import { describe, expect, it } from 'vitest';
import { PROFILE_ACCESS } from './profileAccess';

describe('PROFILE_ACCESS', () => {
  it('gives every audience the roles and only the fields its job needs', () => {
    expect(PROFILE_ACCESS).toEqual({
      planner: ['roles', 'aboutWork', 'workingRules'],
      orchestrator: ['roles', 'aboutWork', 'workingRules'],
      scout: ['roles', 'aboutWork', 'explainMore'],
      investigator: ['roles', 'aboutWork', 'explainMore'],
      implementer: ['roles', 'workingRules'],
      tester: ['roles', 'workingRules'],
      docs: ['roles', 'workingRules'],
      reviewer: ['roles', 'workingRules', 'explainMore'],
      resolver: ['roles', 'workingRules', 'explainMore'],
      report: ['roles', 'aboutWork', 'explainMore'],
      wireframe: ['roles', 'aboutWork', 'explainMore'],
      custom: ['roles', 'aboutWork', 'workingRules', 'explainMore'],
      questionDelegate: ['roles', 'aboutWork', 'workingRules'],
    });
  });
});
