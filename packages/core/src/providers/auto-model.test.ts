import { describe, expect, it } from 'vitest';
import { autoModelForRole } from './auto-model';
import { CURSOR_MODELS } from './cursor/models';

describe('autoModelForRole', () => {
  it('returns null when no providers are available', () => {
    expect(autoModelForRole('planner', [])).toBeNull();
  });

  describe('with the role default provider available', () => {
    it('keeps the curated default for a high-tier role', () => {
      expect(autoModelForRole('planner', ['anthropic'])).toEqual({
        provider: 'anthropic',
        model: 'claude-opus-4-8',
      });
    });

    it('keeps the curated cheap default for a scout role', () => {
      expect(autoModelForRole('scout', ['anthropic'])).toEqual({
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
      });
    });

    it('prefers the default provider even when other providers are enabled', () => {
      expect(autoModelForRole('planner', ['gemini', 'anthropic'])).toEqual({
        provider: 'anthropic',
        model: 'claude-opus-4-8',
      });
    });
  });

  describe('when the default provider is not available', () => {
    it('picks the matching expensive-tier model for a high-tier role', () => {
      expect(autoModelForRole('planner', ['gemini'])).toEqual({
        provider: 'gemini',
        model: 'gemini-3.1-pro',
      });
    });

    it('picks the highest-weight cheap model for a low-tier role', () => {
      expect(autoModelForRole('scout', ['gemini'])).toEqual({
        provider: 'gemini',
        model: 'gemini-3.5-flash',
      });
    });

    it('treats an unknown role as the custom default tier', () => {
      expect(autoModelForRole('totally-made-up', ['gemini'])).toEqual({
        provider: 'gemini',
        model: 'gemini-3.1-pro',
      });
    });

    it('picks the expensive codex model for a high-tier role', () => {
      expect(autoModelForRole('planner', ['codex'])).toEqual({
        provider: 'codex',
        model: 'gpt-5.5',
      });
    });

    it('picks the cheap codex model for a scout role', () => {
      const result = autoModelForRole('scout', ['codex']);
      expect(result?.provider).toBe('codex');
      const model = result?.model ?? '';
      expect(['gpt-5.4-mini', 'gpt-4.1-mini', 'gpt-4.1-nano'].some((m) => model === m)).toBe(true);
    });

    it('weight tie-break: picks highest-weight model when two providers share cost tier', () => {
      const result = autoModelForRole('planner', ['gemini', 'codex']);
      expect(result).not.toBeNull();
      expect(['gemini', 'codex']).toContain(result?.provider);
    });

    it('cursor provider: picks a real cursor slug for a mid-tier role, not auto', () => {
      const result = autoModelForRole('product', ['cursor']);
      expect(result?.provider).toBe('cursor');
      expect(result?.model).not.toBe('auto');
      expect(CURSOR_MODELS.some((m) => m.id === result?.model)).toBe(true);
    });

    it('cursor provider: picks a real expensive slug for a high-tier role', () => {
      const result = autoModelForRole('planner', ['cursor']);
      expect(result).toEqual({ provider: 'cursor', model: 'claude-opus-4-7-thinking-high' });
    });
  });
});
