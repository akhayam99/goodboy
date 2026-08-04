import { describe, expect, it } from 'vitest';
import { autoModelForRole, recommendedModelForRole } from './auto-model';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { CURSOR_MODELS } from './cursor/models';

describe('autoModelForRole', () => {
  it('returns null when no providers are available', () => {
    expect(autoModelForRole({ role: 'planner', providers: [] })).toBeNull();
  });

  describe('with the role default provider available', () => {
    it('keeps the curated default for a high-tier role', () => {
      expect(autoModelForRole({ role: 'planner', providers: ['anthropic'] })).toEqual({
        provider: 'anthropic',
        model: 'opus-5',
      });
    });

    it('keeps the curated cheap default for a scout role', () => {
      expect(autoModelForRole({ role: 'scout', providers: ['anthropic'] })).toEqual({
        provider: 'anthropic',
        model: 'haiku-4.5',
      });
    });

    it('prefers the default provider even when other providers are enabled', () => {
      expect(autoModelForRole({ role: 'planner', providers: ['gemini', 'anthropic'] })).toEqual({
        provider: 'anthropic',
        model: 'opus-5',
      });
    });
  });

  describe('when the default provider is not available', () => {
    it('picks the matching expensive-tier model for a high-tier role', () => {
      expect(autoModelForRole({ role: 'planner', providers: ['gemini'] })).toEqual({
        provider: 'gemini',
        model: 'gemini-3.1-pro',
      });
    });

    it('picks the highest-weight cheap model for a low-tier role', () => {
      expect(autoModelForRole({ role: 'scout', providers: ['gemini'] })).toEqual({
        provider: 'gemini',
        model: 'gemini-3.5-flash',
      });
    });

    it('treats an unknown role as the custom default tier', () => {
      expect(autoModelForRole({ role: 'totally-made-up', providers: ['gemini'] })).toEqual({
        provider: 'gemini',
        model: 'gemini-3.1-pro',
      });
    });

    it('picks the expensive codex model for a high-tier role', () => {
      expect(autoModelForRole({ role: 'planner', providers: ['codex'] })).toEqual({
        provider: 'codex',
        model: 'gpt-5.6',
      });
    });

    it('picks the cheap codex model for a scout role', () => {
      const result = autoModelForRole({ role: 'scout', providers: ['codex'] });
      expect(result?.provider).toBe('codex');
      const model = result?.model ?? '';
      expect(['gpt-5.4-mini', 'gpt-4.1-mini', 'gpt-4.1-nano'].some((m) => model === m)).toBe(true);
    });

    it('weight tie-break: picks highest-weight model when two providers share cost tier', () => {
      const result = autoModelForRole({ role: 'planner', providers: ['gemini', 'codex'] });
      expect(result).not.toBeNull();
      expect(['gemini', 'codex']).toContain(result?.provider);
    });

    it('cursor provider: picks a real cursor slug for a mid-tier role, not auto', () => {
      const result = autoModelForRole({ role: 'reviewer', providers: ['cursor'] });
      expect(result?.provider).toBe('cursor');
      expect(result?.model).not.toBe('auto');
      expect(CURSOR_MODELS.some((m) => m.id === result?.model)).toBe(true);
    });

    it('cursor provider: picks a real expensive slug for a high-tier role', () => {
      const result = autoModelForRole({ role: 'planner', providers: ['cursor'] });
      expect(result).toEqual({ provider: 'cursor', model: 'opus-5' });
    });

    it('substitutes a coding role with Opus, never with a thinker-only model', () => {
      const prefs = {
        implementer: { providerId: 'cursor' as const, model: 'gpt-5.6', effort: 'high' as const },
      };
      expect(autoModelForRole({ role: 'implementer', providers: ['anthropic'], prefs })).toEqual({
        provider: 'anthropic',
        model: 'opus-5',
      });
      expect(recommendedModelForRole({ role: 'implementer', provider: 'anthropic', prefs })).toBe(
        'opus-5',
      );
    });

    it('still reaches for the thinker on a role that only thinks', () => {
      const prefs = {
        planner: { providerId: 'cursor' as const, model: 'gpt-5.6', effort: 'high' as const },
      };
      expect(autoModelForRole({ role: 'planner', providers: ['anthropic'], prefs })).toEqual({
        provider: 'anthropic',
        model: 'fable-5',
      });
    });

    it('leaves the thinker above Opus in raw strength', () => {
      const anthropic = PROVIDER_CAPABILITIES.anthropic.models;
      const fable = anthropic.find((model) => model.id === 'fable-5');
      const opus = anthropic.find((model) => model.id === 'opus-5');
      expect(fable?.weight ?? 0).toBeGreaterThan(opus?.weight ?? 0);
      expect(fable?.thinkerOnly).toBe(true);
      expect(opus?.thinkerOnly).toBe(false);
    });
  });
});
