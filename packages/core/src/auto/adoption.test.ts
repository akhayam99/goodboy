import { describe, expect, it } from 'vitest';
import {
  ADOPTION_DEFAULT_INSTRUCTION,
  ADOPTION_REFUSAL_TEXT,
  adoptionRoleOf,
  buildAdoptedResult,
  composeAdoptionKickoff,
  diagnoseAdoption,
  isAdoptableKind,
  type AdoptionSnapshot,
} from './adoption';
import { renderDelegationResult } from './result';

const standalone: AdoptionSnapshot = {
  isGone: false,
  kind: 'implementer',
  hasRunStep: false,
  isTurnLive: false,
  isInAuto: false,
  isLinkedToAuto: false,
};

describe('which agents Auto can take over', () => {
  it.each([
    ['scout', 'scout'],
    ['planner', 'planner'],
    ['debugger', 'investigator'],
    ['reviewer', 'reviewer'],
    ['implementer', 'implementer'],
    ['tester', 'tester'],
    ['docs', 'docs'],
    ['generic', 'implementer'],
  ])('maps %s to the delegation role %s', (kind, role) => {
    expect(isAdoptableKind({ kind })).toBe(true);
    expect(adoptionRoleOf({ kind })).toBe(role);
  });

  it.each(['auto', 'resolver', 'rewriter', 'scribe', 'ci-fixer', 'pr-reviewer', 'report', ''])(
    'leaves %s alone',
    (kind) => {
      expect(isAdoptableKind({ kind })).toBe(false);
      expect(adoptionRoleOf({ kind })).toBeNull();
    },
  );
});

describe('diagnosing an adoption', () => {
  it('lets a standalone idle agent through', () => {
    expect(diagnoseAdoption(standalone)).toBeNull();
  });

  it('refuses a step of a Run with the sentence the owner asked for', () => {
    const code = diagnoseAdoption({ ...standalone, hasRunStep: true });
    expect(code).toBe('in_run');
    expect(code === null ? '' : ADOPTION_REFUSAL_TEXT[code]).toBe('Pause or finish the run first.');
  });

  it('refuses a second Auto for the same source', () => {
    expect(diagnoseAdoption({ ...standalone, isInAuto: true })).toBe('already_in_auto');
  });

  it('refuses a cycle', () => {
    expect(diagnoseAdoption({ ...standalone, isLinkedToAuto: true })).toBe('cycle');
  });

  it('waits for the turn to end', () => {
    expect(diagnoseAdoption({ ...standalone, isTurnLive: true })).toBe('turn_running');
  });

  it('says a vanished agent is gone before anything else', () => {
    expect(diagnoseAdoption({ ...standalone, isGone: true, hasRunStep: true })).toBe('agent_gone');
  });

  it('refuses a kind that has no role', () => {
    expect(diagnoseAdoption({ ...standalone, kind: 'resolver' })).toBe('not_adoptable');
  });
});

describe('the kickoff Auto gets', () => {
  const base = {
    sourceName: 'agent 2',
    roleLabel: 'Implementer',
    goal: 'Add the retry cap to ledger-core',
    lastReply: 'Added the cap and a test.',
    artifacts: [],
    mountLabel: null,
    instruction: '',
  };

  it('names what the user asked, what the agent said and a default next step', () => {
    const text = composeAdoptionKickoff(base);
    expect(text).toContain('moved agent 2, a Implementer agent');
    expect(text).toContain('Add the retry cap to ledger-core');
    expect(text).toContain('Added the cap and a test.');
    expect(text).toContain(ADOPTION_DEFAULT_INSTRUCTION);
  });

  it('carries the instruction verbatim and the artifacts by id', () => {
    const text = composeAdoptionKickoff({
      ...base,
      artifacts: [{ id: 'plan-1', kind: 'plan', title: 'Retry cap', revision: 2 }],
      mountLabel: 'ledger-core on ak/retry',
      instruction: 'Test it and then review it.',
    });
    expect(text).toContain('- plan-1 (plan) "Retry cap" version 2');
    expect(text).toContain('ledger-core on ak/retry');
    expect(text).toContain('Test it and then review it.');
    expect(text).not.toContain(ADOPTION_DEFAULT_INSTRUCTION);
  });

  it('clips a long reply and leaves out empty parts', () => {
    const text = composeAdoptionKickoff({ ...base, goal: '', lastReply: 'x'.repeat(5_000) });
    expect(text).not.toContain('What the user asked');
    expect(text.length).toBeLessThan(2_600);
    expect(text).toContain('...');
  });
});

describe('the result Auto reads for the adopted agent', () => {
  const result = buildAdoptedResult({
    delegationId: 'delegation-adopt-1',
    attemptId: 'attempt-adopt-1',
    treeId: 'tree-1',
    childAgentId: 'agent-2',
    role: 'implementer',
    routing: { provider: 'anthropic', model: 'sonnet', effort: 'medium' },
    summary: 'Added the cap and a test.',
    artifacts: [],
  });

  it('is a completed result that says where it comes from', () => {
    expect(result).toMatchObject({
      schemaVersion: 1,
      outcome: 'completed',
      artifactPersistence: 'not_applicable',
      routing: { reason: 'Adopted from a standalone agent' },
      declared: { completion: 'done', summary: 'Added the cap and a test.' },
    });
  });

  it('renders for the model like any other result', () => {
    expect(renderDelegationResult({ result })).toContain('it said: Added the cap and a test.');
  });
});
