import { describe, expect, it } from 'vitest';
import { detectScopeMismatch } from './scope-mismatch';

describe('detectScopeMismatch', () => {
  describe('planner', () => {
    it('flags imperative "implementa" with no planning frame', () => {
      const r = detectScopeMismatch({ input: 'implementa la nuova feature', agentKind: 'planner' });
      expect(r?.kind).toBe('planner-asked-to-implement');
      expect(r?.suggestedAgentKind).toBe('implementer');
    });

    it('flags "fixa il bug"', () => {
      expect(
        detectScopeMismatch({ input: 'fixa il bug nel login', agentKind: 'planner' })?.kind,
      ).toBe('planner-asked-to-implement');
    });

    it('does NOT flag "fammi un piano così posso implementare"', () => {
      expect(
        detectScopeMismatch({
          input: 'fammi un piano così posso implementare',
          agentKind: 'planner',
        }),
      ).toBeNull();
    });

    it('does NOT flag "spiega come implementare"', () => {
      expect(
        detectScopeMismatch({ input: 'spiega come implementare auth', agentKind: 'planner' }),
      ).toBeNull();
    });

    it('does NOT flag mid-sentence mention without imperative lead', () => {
      expect(
        detectScopeMismatch({
          input: 'mi serve un piano per il refactor del modulo auth',
          agentKind: 'planner',
        }),
      ).toBeNull();
    });

    it('does NOT flag plain question', () => {
      expect(
        detectScopeMismatch({ input: 'come funziona il modulo auth?', agentKind: 'planner' }),
      ).toBeNull();
    });
  });

  describe('implementer / debugger / tester', () => {
    it('flags "fammi un piano" on implementer', () => {
      const r = detectScopeMismatch({
        input: 'fammi un piano per il refactor',
        agentKind: 'implementer',
      });
      expect(r?.kind).toBe('implementer-asked-to-plan');
      expect(r?.suggestedAgentKind).toBe('planner');
    });

    it('flags "design the migration" on debugger', () => {
      expect(
        detectScopeMismatch({ input: 'design the migration steps', agentKind: 'debugger' })?.kind,
      ).toBe('implementer-asked-to-plan');
    });

    it('does NOT flag when message also asks for implementation', () => {
      expect(
        detectScopeMismatch({
          input: 'fammi un piano e poi implementa il primo step',
          agentKind: 'implementer',
        }),
      ).toBeNull();
    });
  });

  describe('out-of-scope kinds', () => {
    it('returns null for generic', () => {
      expect(detectScopeMismatch({ input: 'implementa tutto', agentKind: 'generic' })).toBeNull();
    });
  });

  it('returns null for empty input', () => {
    expect(detectScopeMismatch({ input: '   ', agentKind: 'planner' })).toBeNull();
  });
});
