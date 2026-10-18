import { describe, expect, it } from 'vitest';
import { AUTO_RUNG_CHOICES, type CuratedProviderId } from './defaults';
import { EFFORT_LADDER, RUNGS, rungsNear } from './effortLadder';

const PROVIDERS = Object.keys(EFFORT_LADDER).filter(
  (id): id is CuratedProviderId => id in EFFORT_LADDER,
);

describe('EFFORT_LADDER', () => {
  it('has five rungs on every curated provider', () => {
    expect(PROVIDERS).toEqual(['anthropic', 'codex', 'gemini', 'cursor']);
    for (const provider of PROVIDERS) {
      expect(Object.keys(EFFORT_LADDER[provider])).toEqual([...RUNGS]);
    }
  });

  it('resolves every rung to at least one catalog model on every curated provider', () => {
    for (const provider of PROVIDERS) {
      for (const rung of RUNGS) {
        expect(AUTO_RUNG_CHOICES[provider][rung].length, `${provider} ${rung}`).toBeGreaterThan(0);
      }
    }
  });

  it('puts Haiku 5.5, Luna and Flash on the two lowest rungs, never an agent line', () => {
    expect(AUTO_RUNG_CHOICES.anthropic.quick[0]).toEqual({ key: 'haiku-5.5', effort: 'low' });
    expect(AUTO_RUNG_CHOICES.anthropic.light[0]).toEqual({ key: 'haiku-5.5', effort: 'medium' });
    expect(AUTO_RUNG_CHOICES.codex.quick[0]).toEqual({ key: 'gpt-6-luna', effort: 'low' });
    expect(AUTO_RUNG_CHOICES.gemini.light[0]?.key).toBe('gemini-3.8-flash');
  });

  it('refills the Codex mid rungs with GPT-6.1 Sol now that Terra is legacy', () => {
    const keys = [...AUTO_RUNG_CHOICES.codex.standard, ...AUTO_RUNG_CHOICES.codex.hard].map(
      (choice) => choice.key,
    );
    expect(keys).not.toContain('gpt-5.6-terra');
    expect(AUTO_RUNG_CHOICES.codex.standard[0]).toEqual({ key: 'gpt-6.1-sol', effort: 'medium' });
    expect(AUTO_RUNG_CHOICES.codex.hard[0]).toEqual({ key: 'gpt-6.1-sol', effort: 'high' });
  });
});

describe('rungsNear', () => {
  it('goes down the ladder from the nearest rung and never climbs for a normal step', () => {
    expect(rungsNear({ rung: 'hard', isHeavy: false })).toEqual(['standard', 'light', 'quick']);
    expect(rungsNear({ rung: 'quick', isHeavy: false })).toEqual([]);
  });

  it('climbs first and then goes down when the step is heavy', () => {
    expect(rungsNear({ rung: 'standard', isHeavy: true })).toEqual([
      'hard',
      'top',
      'light',
      'quick',
    ]);
  });
});
