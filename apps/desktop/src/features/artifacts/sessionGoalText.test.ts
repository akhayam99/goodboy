import { describe, expect, it } from 'vitest';
import type { ContextSlot, Session } from '@goodboy/types';
import { REDACTED } from '../../shared/utils/redactSecrets';
import { SESSION_GOAL_LIMITS, sessionGoalText } from './sessionGoalText';

const TITLE = 'Fix the rounding drift in ledger-core postings';

const session: Pick<Session, 'goal'> = { goal: TITLE };

const goalSlot = ({
  value,
  enabled = true,
}: {
  readonly value: string;
  readonly enabled?: boolean;
}): ContextSlot => ({ key: 'goal', value, enabled });

const LONG = [
  'Northwind settles ledger-core postings twice a day and the second pass rounds the residual away.',
  'Walk the notify-relay receipts against the ledger and show where the cent goes missing.',
  'The fix has to hold for a partial refund inside the same settlement window.',
].join('\n\n');

describe('sessionGoalText', () => {
  it('falls back to the title when the session has no goal slot', () => {
    expect(sessionGoalText({ slots: [], session })).toEqual({
      editorText: TITLE,
      packText: TITLE,
      isClipped: false,
      isDetailed: false,
    });
  });

  it('falls back to the title when another slot carries the long text', () => {
    const slots = [{ key: 'decisions', value: LONG, enabled: true } satisfies ContextSlot];
    expect(sessionGoalText({ slots, session })).toEqual({
      editorText: TITLE,
      packText: TITLE,
      isClipped: false,
      isDetailed: false,
    });
  });

  it('respects a disabled goal slot and keeps the title', () => {
    const slots = [goalSlot({ value: LONG, enabled: false })];
    expect(sessionGoalText({ slots, session })).toEqual({
      editorText: TITLE,
      packText: TITLE,
      isClipped: false,
      isDetailed: false,
    });
  });

  it.each(['', '  \n\t '])('keeps the title for an empty goal slot (%j)', (value) => {
    expect(sessionGoalText({ slots: [goalSlot({ value })], session })).toEqual({
      editorText: TITLE,
      packText: TITLE,
      isClipped: false,
      isDetailed: false,
    });
  });

  it('is not detailed when the slot only repeats the title', () => {
    const slots = [goalSlot({ value: `  ${TITLE}\n` })];
    expect(sessionGoalText({ slots, session })).toEqual({
      editorText: TITLE,
      packText: TITLE,
      isClipped: false,
      isDetailed: false,
    });
  });

  it('uses the slot when it says more than the title', () => {
    expect(sessionGoalText({ slots: [goalSlot({ value: `  ${LONG}  ` })], session })).toEqual({
      editorText: LONG,
      packText: LONG,
      isClipped: false,
      isDetailed: true,
    });
  });

  it('clips a goal slot over the limit and flags it', () => {
    const value = 'Harborline '.repeat(SESSION_GOAL_LIMITS.chars);
    const result = sessionGoalText({ slots: [goalSlot({ value })], session });
    expect(result.isDetailed).toBe(true);
    expect(result.isClipped).toBe(true);
    expect(result.packText).toHaveLength(SESSION_GOAL_LIMITS.chars);
    expect(value.startsWith(result.packText)).toBe(true);
    expect(result.editorText).toBe(value.trim());
  });

  it('keeps a goal slot exactly at the limit whole', () => {
    const value = 'a'.repeat(SESSION_GOAL_LIMITS.chars);
    expect(sessionGoalText({ slots: [goalSlot({ value })], session })).toEqual({
      editorText: value,
      packText: value,
      isClipped: false,
      isDetailed: true,
    });
  });
});

describe('sessionGoalText secrets', () => {
  it('redacts before the cut so a straddling secret leaves no plaintext fragment', () => {
    const value = `${'a'.repeat(SESSION_GOAL_LIMITS.chars - 12)} api_key=harborline-test-value ${'b'.repeat(100)}`;
    expect(value.slice(0, SESSION_GOAL_LIMITS.chars)).toContain('api_key=har');

    const result = sessionGoalText({ slots: [goalSlot({ value })], session });
    expect(result.isClipped).toBe(true);
    expect(result.packText).not.toContain('api_key=har');
    expect(result.packText).not.toContain('harborline');
  });

  it('hands the editor the untouched text the user wrote', () => {
    const value = `${LONG}\n\nuse api_key=harborline-test-value`;
    const result = sessionGoalText({ slots: [goalSlot({ value })], session });
    expect(result.editorText).toBe(value);
    expect(result.editorText).toContain('harborline-test-value');
    expect(result.packText).not.toContain('harborline-test-value');
    expect(result.packText).toContain(REDACTED);
  });

  it('measures the clip against the redacted text, not the raw text', () => {
    const secret = ' api_key=harborline-test-value';
    const value = `${'a'.repeat(SESSION_GOAL_LIMITS.chars - 5)}${secret}`;
    const result = sessionGoalText({ slots: [goalSlot({ value })], session });
    expect(value.length).toBeGreaterThan(SESSION_GOAL_LIMITS.chars);
    expect(result.packText.length).toBeLessThanOrEqual(SESSION_GOAL_LIMITS.chars);
    expect(result.packText).not.toContain('harborline');
  });
});
