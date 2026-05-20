import { describe, expect, it } from 'vitest';
import { detectScopeMismatch } from './scope-mismatch';

describe('detectScopeMismatch', () => {
  describe('planner', () => {
    it('flags imperative "implementa" with no planning frame', () => {
      const r = detectScopeMismatch('implementa la nuova feature', 'planner');
      expect(r?.kind).toBe('planner-asked-to-implement');
      expect(r?.suggestedAgentKind).toBe('implementer');
    });

    it('flags "fixa il bug"', () => {
      expect(detectScopeMismatch('fixa il bug nel login', 'planner')?.kind).toBe(
        'planner-asked-to-implement',
      );
    });

    it('does NOT flag "fammi un piano così posso implementare"', () => {
      expect(detectScopeMismatch('fammi un piano così posso implementare', 'planner')).toBeNull();
    });

    it('does NOT flag "spiega come implementare"', () => {
      expect(detectScopeMismatch('spiega come implementare auth', 'planner')).toBeNull();
    });

    it('does NOT flag mid-sentence mention without imperative lead', () => {
      expect(
        detectScopeMismatch('mi serve un piano per il refactor del modulo auth', 'planner'),
      ).toBeNull();
    });

    it('does NOT flag plain question', () => {
      expect(detectScopeMismatch('come funziona il modulo auth?', 'planner')).toBeNull();
    });
  });

  describe('implementer / debugger / tester', () => {
    it('flags "fammi un piano" on implementer', () => {
      const r = detectScopeMismatch('fammi un piano per il refactor', 'implementer');
      expect(r?.kind).toBe('implementer-asked-to-plan');
      expect(r?.suggestedAgentKind).toBe('planner');
    });

    it('flags "design the migration" on debugger', () => {
      expect(detectScopeMismatch('design the migration steps', 'debugger')?.kind).toBe(
        'implementer-asked-to-plan',
      );
    });

    it('does NOT flag when message also asks for implementation', () => {
      expect(
        detectScopeMismatch('fammi un piano e poi implementa il primo step', 'implementer'),
      ).toBeNull();
    });
  });

  describe('out-of-scope kinds', () => {
    it('returns null for generic', () => {
      expect(detectScopeMismatch('implementa tutto', 'generic')).toBeNull();
    });

    it('returns null for init', () => {
      expect(detectScopeMismatch('fammi un piano', 'init')).toBeNull();
    });
  });

  it('returns null for empty input', () => {
    expect(detectScopeMismatch('   ', 'planner')).toBeNull();
  });
});
